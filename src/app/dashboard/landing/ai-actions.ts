'use server'

import { revalidatePath } from 'next/cache'
import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { aiConversations, aiMessages, categories, funnels, products } from '@/db/schema'
import type { AiToolCall } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { recordAudit } from '@/lib/audit'
import { designerKey, getClaudeConfig, isClaudeReady } from '@/lib/ai/settings'
import { getStoreBrief } from '@/lib/ai/store-context'
import { generateLanding, type ProductContext } from '@/lib/ai/landing-generator'
import { landingPlanSchema, type LandingPlan } from '@/lib/ai/landing-schema'
import { getStoreTheme } from '@/lib/storefront'
import { formatMoney, slugify } from '@/lib/utils'
import { BLOCK_LIBRARY, type Block } from '@/lib/landing'
import type { ClaudeMessage } from '@/lib/ai/claude'

export type LandingChatMsg = {
  id: string
  role: 'user' | 'model'
  text: string
  plan: LandingPlan | null
  /** معرّف الصفحة اللي اتعملت من الخطة دي */
  createdId: string | null
}

export type LandingChatState =
  | { ok: true; conversationId: string; messages: LandingChatMsg[] }
  | { ok: false; error: string; needsSetup?: boolean }

function toMessages(
  rows: Array<{ id: string; role: 'user' | 'model'; text: string; toolCalls: AiToolCall[] }>,
): LandingChatMsg[] {
  return rows.map((r) => {
    const call = r.toolCalls[0]
    const parsed = call ? landingPlanSchema.safeParse(call.args) : null

    return {
      id: r.id,
      role: r.role,
      text: r.text,
      plan: parsed?.success ? parsed.data : null,
      createdId: call?.status === 'done' ? (call.result ?? null) : null,
    }
  })
}

async function loadMessages(conversationId: string): Promise<LandingChatMsg[]> {
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

/** منتجات المتجر للاختيار منها — الحد الأدنى اللي القايمة محتاجاه */
export async function listProductsForLandingAction() {
  const { store } = await getDashboardContext()

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      images: products.images,
    })
    .from(products)
    .where(
      and(eq(products.storeId, store.id), eq(products.status, 'active'), isNull(products.deletedAt)),
    )
    .orderBy(desc(products.soldCount), asc(products.name))
    .limit(200)

  return rows.map((p) => ({
    id: p.id,
    name: p.name,
    price: formatMoney(p.price, store.currency),
    image: p.images?.[0] ?? null,
  }))
}

async function loadProduct(storeId: string, currency: string, productId: string | null) {
  if (!productId) return null

  const [row] = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      brand: products.brand,
      images: products.images,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)))
    .limit(1)

  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    price: formatMoney(row.price, currency),
    compareAt: row.compareAtPrice ? formatMoney(row.compareAtPrice, currency) : null,
    category: row.categoryName,
    brand: row.brand,
    images: row.images?.length ?? 0,
  } satisfies ProductContext
}

const sendSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(2, 'اوصف الصفحة اللي عايزها').max(2000),
  productId: z.string().uuid().nullable().optional(),
})

/**
 * طلب صفحة هبوط من كلود.
 *
 * المنتج المختار بيتبعت كاملًا (اسم، سعر، وصف، ماركة) — ده اللي
 * بيخلّي الصفحة عن المنتج ده بالظبط بدل كلام عام. ولو التاجر قال
 * «بهوية متجري» بنبعت ألوان المتجر كمان.
 */
export async function sendLandingRequestAction(raw: unknown): Promise<LandingChatState> {
  const parsed = sendSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { store, user } = await getDashboardContext()
  const cfg = await getClaudeConfig(store.id)

  if (!cfg.enabled) return { ok: false, error: 'فعّل إضافة Claude الأول.', needsSetup: true }
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
        kind: 'landing',
        title: parsed.data.message.slice(0, 40),
        targetId: parsed.data.productId ?? null,
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
  const history: ClaudeMessage[] = previous
    .slice(-6)
    .map((m) =>
      m.role === 'user'
        ? { role: 'user' as const, text: m.text }
        : { role: 'assistant' as const, text: m.plan ? JSON.stringify(m.plan) : m.text },
    )
    .slice(0, -1)

  const [brief, product, theme] = await Promise.all([
    getStoreBrief(store.id),
    loadProduct(store.id, store.currency, parsed.data.productId ?? null),
    getStoreTheme(store.id),
  ])

  const result = await generateLanding({
    provider: cfg.provider,
    // `isClaudeReady` فوق ضمنت وجود المفتاح والموديل
    apiKey: designerKey(cfg)!,
    model: cfg.model!,
    brief,
    product,
    storeColors: {
      primary: theme.custom.identity.primary,
      background: theme.custom.identity.background,
      surface: theme.custom.identity.surface,
      text: theme.custom.identity.text,
    },
    history,
    request: parsed.data.message,
  })

  if (!result.ok) return { ok: false, error: result.error, needsSetup: result.needsSetup }

  const warning = result.contrast.length
    ? `\n\n⚠️ ${result.contrast.map((c) => `${c.pair} تباينه ${c.ratio}`).join('، ')} — جرّب «خلّي النص أغمق».`
    : ''

  await db.insert(aiMessages).values({
    conversationId,
    storeId: store.id,
    role: 'model',
    text: result.reply + warning,
    toolCalls: [{ name: 'create_landing', args: result.plan, status: 'pending' }],
  })

  await db
    .update(aiConversations)
    .set({ updatedAt: new Date() })
    .where(eq(aiConversations.id, conversationId))

  return { ok: true, conversationId, messages: await loadMessages(conversationId) }
}

/**
 * إنشاء الصفحة من الخطة.
 *
 * **بتتعمل مسوّدة لا منشورة.** التاجر بيفتح المحرّر ويعدّل ويشوف
 * المعاينة قبل ما يوصّلها لعميل — صفحة إعلانية بتروح للناس على طول
 * غلط، خصوصًا إن آراء العملاء فيها مولّدة ولازم يستبدلها.
 */
export async function createLandingFromPlanAction(
  messageId: string,
): Promise<LandingChatState & { landingId?: string }> {
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
  if (call.status === 'done') {
    return { ok: false, error: 'الصفحة دي اتعملت قبل كده' }
  }

  const checked = landingPlanSchema.safeParse(call.args)
  if (!checked.success) return { ok: false, error: 'الخطة مش صالحة' }
  const plan = checked.data

  // المنتج المربوط بالمحادثة — عشان بلوك المنتج يشتغل
  const [conv] = await db
    .select({ targetId: aiConversations.targetId })
    .from(aiConversations)
    .where(eq(aiConversations.id, msg.conversationId))
    .limit(1)

  const blocks: Block[] = plan.blocks.map((b, i) => {
    const def = BLOCK_LIBRARY.find((d) => d.type === b.type)
    const { type, ...settings } = b
    return { id: `ai${Date.now()}${i}`, type, settings: { ...(def?.defaults ?? {}), ...settings } }
  })

  const slug = await uniqueSlug(store.id, slugify(plan.name) || 'offer')

  const [created] = await db
    .insert(funnels)
    .values({
      storeId: store.id,
      slug,
      name: plan.name,
      productId: conv?.targetId ?? null,
      template: 'ai',
      blocks,
      tokens: plan.tokens ?? {},
      status: 'draft',
    })
    .returning({ id: funnels.id })

  const calls: AiToolCall[] = [{ ...call, status: 'done', result: created.id }]
  await db.update(aiMessages).set({ toolCalls: calls }).where(eq(aiMessages.id, msg.id))

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'landing_ai',
    resourceId: created.id,
    after: { name: plan.name, blocks: plan.blocks.length },
  })

  revalidatePath('/dashboard/landing')

  return {
    ok: true,
    conversationId: msg.conversationId,
    messages: await loadMessages(msg.conversationId),
    landingId: created.id,
  }
}

async function uniqueSlug(storeId: string, base: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`
    const clash = await db
      .select({ id: funnels.id })
      .from(funnels)
      .where(and(eq(funnels.storeId, storeId), eq(funnels.slug, candidate)))
      .limit(1)
    if (clash.length === 0) return candidate
  }
  return `${base}-${Date.now()}`
}

export async function listLandingChatsAction() {
  const { store } = await getDashboardContext()

  return db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      updatedAt: aiConversations.updatedAt,
    })
    .from(aiConversations)
    .where(and(eq(aiConversations.storeId, store.id), eq(aiConversations.kind, 'landing')))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(30)
}

export async function loadLandingChatAction(id: string): Promise<LandingChatState> {
  const { store } = await getDashboardContext()

  const [own] = await db
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.storeId, store.id)))
    .limit(1)

  if (!own) return { ok: false, error: 'المحادثة مش موجودة' }
  return { ok: true, conversationId: id, messages: await loadMessages(id) }
}

export async function deleteLandingChatAction(id: string): Promise<{ ok: boolean }> {
  const { store } = await getDashboardContext()
  await db
    .delete(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.storeId, store.id)))
  return { ok: true }
}
