'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { aiConversations, aiMessages, storeThemes } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { recordAudit } from '@/lib/audit'
import { getClaudeConfig, isClaudeReady } from '@/lib/ai/settings'
import { getStoreBrief } from '@/lib/ai/store-context'
import { generateTheme } from '@/lib/ai/theme-generator'
import { themePlanSchema, checkContrast, type ThemePlan } from '@/lib/ai/theme-schema'
import { getStoreTheme } from '@/lib/storefront'
import { mergeCustomization, type PanelKey } from '@/lib/customization'
import type { ClaudeMessage } from '@/lib/ai/claude'
import type { AiToolCall } from '@/db/schema'

export type ThemeChatMsg = {
  id: string
  role: 'user' | 'model'
  text: string
  /** الخطة المقترحة — بتتخزّن في toolCalls عشان نعيد استخدام نفس الجدول */
  plan: ThemePlan | null
  applied: boolean
}

export type ThemeChatState =
  | { ok: true; conversationId: string; messages: ThemeChatMsg[] }
  | { ok: false; error: string; needsSetup?: boolean }

/**
 * تحويل صفوف الرسايل لشكل الواجهة.
 *
 * الخطة متخزّنة في عمود toolCalls بدل جدول جديد: هي فعلًا «إجراء
 * مقترح مستني موافقة» — نفس فكرة أدوات المساعد بالظبط.
 */
function toMessages(
  rows: Array<{ id: string; role: 'user' | 'model'; text: string; toolCalls: AiToolCall[] }>,
): ThemeChatMsg[] {
  return rows.map((r) => {
    const call = r.toolCalls[0]
    const parsed = call ? themePlanSchema.safeParse(call.args) : null

    return {
      id: r.id,
      role: r.role,
      text: r.text,
      plan: parsed?.success ? parsed.data : null,
      applied: call?.status === 'done',
    }
  })
}

async function loadMessages(conversationId: string): Promise<ThemeChatMsg[]> {
  const rows = await db
    .select({
      id: aiMessages.id,
      role: aiMessages.role,
      text: aiMessages.text,
      toolCalls: aiMessages.toolCalls,
    })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(aiMessages.createdAt)

  return toMessages(rows as never)
}

const sendSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(2, 'اوصف الثيم اللي عايزه').max(2000),
})

export async function sendThemeRequestAction(raw: unknown): Promise<ThemeChatState> {
  const parsed = sendSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { store, user } = await getDashboardContext()
  const cfg = await getClaudeConfig(store.id)

  if (!cfg.enabled) {
    return { ok: false, error: 'فعّل إضافة Claude الأول.', needsSetup: true }
  }
  if (!isClaudeReady(cfg)) {
    return { ok: false, error: 'الإضافة ناقصها المفتاح أو الموديل.', needsSetup: true }
  }

  let conversationId = parsed.data.conversationId
  if (!conversationId) {
    const [created] = await db
      .insert(aiConversations)
      .values({
        storeId: store.id,
        userId: user.id,
        kind: 'theme',
        title: parsed.data.message.slice(0, 40),
      })
      .returning({ id: aiConversations.id })
    conversationId = created.id
  } else {
    const [own] = await db
      .select({ id: aiConversations.id })
      .from(aiConversations)
      .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.storeId, store.id)))
      .limit(1)
    if (!own) return { ok: false, error: 'المحادثة مش موجودة' }
  }

  await db.insert(aiMessages).values({
    conversationId,
    storeId: store.id,
    role: 'user',
    text: parsed.data.message,
  })

  const previous = await loadMessages(conversationId)

  /*
    السجل بيتحوّل لرسايل نصّية: خطة كلود السابقة بترجع كـJSON عشان
    يفهم اللي اقترحه قبل كده. من غيرها «خلّي الخلفية أفتح» بتبقى
    طلبًا بلا سياق وبيبدأ من الأول.
  */
  const history: ClaudeMessage[] = previous
    .filter((m) => m.text || m.plan)
    .slice(-8)
    .map((m) =>
      m.role === 'user'
        ? { role: 'user' as const, text: m.text }
        : { role: 'assistant' as const, text: m.plan ? JSON.stringify(m.plan) : m.text },
    )
    // آخر رسالة هي طلب التاجر الحالي — بتتبعت لوحدها
    .slice(0, -1)

  const brief = await getStoreBrief(store.id)

  const result = await generateTheme({
    apiKey: cfg.apiKey,
    model: cfg.model,
    brief,
    history,
    request: parsed.data.message,
  })

  if (!result.ok) {
    return { ok: false, error: result.error, needsSetup: result.needsSetup }
  }

  const warning = result.contrast.length
    ? `\n\n⚠️ تنبيه: ${result.contrast
        .map((c) => `${c.pair} تباينه ${c.ratio} (المفروض ٤٫٥ على الأقل)`)
        .join('، ')}. جرّب تقولّي «خلّي النص أغمق».`
    : ''

  await db.insert(aiMessages).values({
    conversationId,
    storeId: store.id,
    role: 'model',
    text: result.reply + warning,
    toolCalls: [{ name: 'apply_theme', args: result.plan, status: 'pending' }],
  })

  await db
    .update(aiConversations)
    .set({ updatedAt: new Date() })
    .where(eq(aiConversations.id, conversationId))

  return { ok: true, conversationId, messages: await loadMessages(conversationId) }
}

/**
 * تطبيق الخطة على مسوّدة المتجر.
 *
 * **على المسوّدة لا على المنشور.** التاجر بيشوف النتيجة في المعاينة
 * وينشر لما يعجبه — ثيم مولّد بيروح للعملاء على طول كارثة لو طلع
 * وحش، والمتجر شغّال وبيبيع.
 *
 * والدمج فوق إعداداته الحالية: أي حقل كلود ما حطّهوش بيفضل زي ما هو،
 * فشعاره وواتسابه وأرقامه ما بتضيعش.
 */
export async function applyThemePlanAction(messageId: string): Promise<ThemeChatState> {
  const { store, user } = await getDashboardContext()

  const [msg] = await db
    .select({
      id: aiMessages.id,
      conversationId: aiMessages.conversationId,
      toolCalls: aiMessages.toolCalls,
    })
    .from(aiMessages)
    .where(and(eq(aiMessages.id, messageId), eq(aiMessages.storeId, store.id)))
    .limit(1)

  if (!msg) return { ok: false, error: 'الرسالة مش موجودة' }

  const call = msg.toolCalls[0]
  if (!call) return { ok: false, error: 'مفيش خطة في الرسالة دي' }

  const checked = themePlanSchema.safeParse(call.args)
  if (!checked.success) return { ok: false, error: 'الخطة مش صالحة' }

  const plan = checked.data

  // الشكل الحالي — الدمج فوقه عشان اللي مش في الخطة يفضل
  const theme = await getStoreTheme(store.id, true)

  const patch: Partial<Record<PanelKey, unknown>> = {}
  for (const key of [
    'identity',
    'announcement',
    'header',
    'hero',
    'listing',
    'productPage',
    'cart',
    'preloader',
  ] as const) {
    const value = plan[key]
    if (value && Object.keys(value).length > 0) patch[key] = value
  }

  const merged = mergeCustomization(theme.custom, patch)

  await db
    .update(storeThemes)
    .set({ draft: merged })
    .where(eq(storeThemes.storeId, store.id))

  const calls: AiToolCall[] = [{ ...call, status: 'done', result: `اتطبّق «${plan.name}»` }]
  await db.update(aiMessages).set({ toolCalls: calls }).where(eq(aiMessages.id, msg.id))

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'theme_ai',
    resourceId: msg.id,
    after: { name: plan.name, panels: Object.keys(patch) },
  })

  revalidatePath('/dashboard/storefront')
  revalidatePath('/dashboard/storefront/customize')

  return {
    ok: true,
    conversationId: msg.conversationId,
    messages: await loadMessages(msg.conversationId),
  }
}

export async function listThemeChatsAction() {
  const { store } = await getDashboardContext()

  return db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      updatedAt: aiConversations.updatedAt,
    })
    .from(aiConversations)
    .where(and(eq(aiConversations.storeId, store.id), eq(aiConversations.kind, 'theme')))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(30)
}

export async function loadThemeChatAction(id: string): Promise<ThemeChatState> {
  const { store } = await getDashboardContext()

  const [own] = await db
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.storeId, store.id)))
    .limit(1)

  if (!own) return { ok: false, error: 'المحادثة مش موجودة' }
  return { ok: true, conversationId: id, messages: await loadMessages(id) }
}

export async function deleteThemeChatAction(id: string): Promise<{ ok: boolean }> {
  const { store } = await getDashboardContext()
  await db
    .delete(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.storeId, store.id)))
  return { ok: true }
}

/** تصدير الخطة كملف — التاجر يحتفظ بيها أو يبعتها لمصمّم */
export async function exportThemePlanAction(messageId: string): Promise<string | null> {
  const { store } = await getDashboardContext()

  const [msg] = await db
    .select({ toolCalls: aiMessages.toolCalls })
    .from(aiMessages)
    .where(and(eq(aiMessages.id, messageId), eq(aiMessages.storeId, store.id)))
    .limit(1)

  const call = msg?.toolCalls?.[0]
  if (!call) return null

  return JSON.stringify(call.args, null, 2)
}

export { checkContrast }
