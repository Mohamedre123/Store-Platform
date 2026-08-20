'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { aiConversations, aiMessages, type AiToolCall } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { recordAudit } from '@/lib/audit'
import { getAiConfig, isReady, GEMINI_PRO_SLUG, GEMINI_SLUG } from '@/lib/ai/settings'
import { getStoreBrief, briefLine } from '@/lib/ai/store-context'
import { agentTurn, type AgentMessage } from '@/lib/ai/gemini'
import { AGENT_TOOLS, executeTool, getTool } from '@/lib/ai/agent-tools'

export type AgentMsg = {
  id: string
  role: 'user' | 'model'
  text: string
  images: string[]
  toolCalls: AiToolCall[]
}

export type AgentState =
  | { ok: true; conversationId: string; messages: AgentMsg[] }
  | { ok: false; error: string; needsSetup?: boolean }

/**
 * مفتاح المساعد.
 *
 * لو إضافة Pro مالهاش مفتاح خاص، بتستخدم مفتاح Gemini العادي.
 * التاجر اللي حط مفتاحه مرة ما يصحّش نطلبه منه تاني — واللي عايز
 * مفتاحًا منفصل للفوترة يقدر يحطّه.
 */
type KeyResult =
  | { ok: true; apiKey: string; model: string }
  | { ok: false; error: string; needsSetup: boolean }

async function resolveKey(storeId: string): Promise<KeyResult> {
  const pro = await getAiConfig(storeId, GEMINI_PRO_SLUG)
  if (!pro.enabled) {
    return { ok: false, error: 'فعّل إضافة Gemini Pro الأول.', needsSetup: true }
  }

  if (pro.apiKey && pro.model) return { ok: true, apiKey: pro.apiKey, model: pro.model }

  const base = await getAiConfig(storeId, GEMINI_SLUG)
  const model = pro.model ?? base.model
  if (base.apiKey && model) return { ok: true, apiKey: base.apiKey, model }

  return { ok: false, error: 'محتاج مفتاح Gemini في الإضافات.', needsSetup: true }
}

/** تعليمات المساعد */
async function buildSystem(storeId: string, brief: string | null, storeName: string) {
  const info = await getStoreBrief(storeId, brief)

  return [
    `إنت مساعد داخل لوحة تحكم متجر «${storeName}» بتتكلم مع صاحب المتجر.`,
    `عن المتجر: ${briefLine(info)}`,
    '',
    'دورك حاجتين مع بعض:',
    '١. **تشرح.** كتير من التجّار مش فاهمين اللوحة. لو سأل «أعمل خصم إزاي»',
    '   اشرحله بجملتين بالعربي المصري البسيط، من غير مصطلحات.',
    '٢. **تنفّذ.** بعد ما تشرح، اعرض عليه تعملها مكانه — واعملها فعلًا',
    '   بالأدوات. التاجر اللي مش فاهم مش هينفّذ لوحده مهما شرحت له.',
    '',
    'قواعد ملزمة:',
    '- اقرا قبل ما تكتب: استخدم search_products وlist_categories قبل أي تعديل',
    '  عشان تشتغل على العنصر الصح لا على تخمين.',
    '- **ما تخترعش بيانات.** لو ناقصك سعر أو كمية أو اسم، اسأل التاجر.',
    '  منتج بسعر مخترع كارثة.',
    '- الأسعار اللي بتتكلم بيها بالجنيه العادي، لا بالقرش.',
    '- لو التاجر طلب حاجة أنت مالكش أداة ليها، قوله بصراحة إنك ما تقدرش',
    '  وقوله يعملها منين في اللوحة — ما تدّعيش إنك عملتها.',
    '- ردودك قصيرة. جملتين أو تلاتة، وبعدين نفّذ أو اسأل.',
    '- لو بعتلك صور منتج، اقرا منها الاسم والخامة واللون واقترحهم عليه.',
    '',
    'كل إجراء بيغيّر حاجة في المتجر بيتعرض على التاجر ويستنى موافقته قبل',
    'ما يتنفّذ — فما تقولش «تمام عملتها» قبل ما توصلك نتيجة التنفيذ.',
  ].join('\n')
}

/** تحويل رسايل الحوار المحفوظة لصيغة الموديل */
function toAgentMessages(rows: AgentMsg[]): AgentMessage[] {
  const out: AgentMessage[] = []

  for (const m of rows) {
    if (m.role === 'user') {
      out.push({ role: 'user', text: m.text })
      continue
    }

    out.push({
      role: 'model',
      text: m.text || undefined,
      calls: m.toolCalls.length
        ? m.toolCalls.map((c) => ({ name: c.name, args: c.args }))
        : undefined,
    })

    /*
      نتيجة كل أداة بترجع للموديل كرسالة أداة — من غيرها بيفضل
      يقترح نفس الإجراء تاني لأنه ما يعرفش إنه اتنفّذ.
    */
    for (const c of m.toolCalls) {
      out.push({
        role: 'tool',
        name: c.name,
        result:
          c.status === 'done'
            ? { ok: true, result: c.result ?? 'اتنفّذ' }
            : c.status === 'rejected'
              ? { ok: false, error: 'التاجر رفض الإجراء ده' }
              : c.status === 'failed'
                ? { ok: false, error: c.result ?? 'فشل التنفيذ' }
                : { ok: false, error: 'لسه مستنية موافقة التاجر' },
      })
    }
  }

  return out
}

async function loadMessages(conversationId: string): Promise<AgentMsg[]> {
  const rows = await db
    .select({
      id: aiMessages.id,
      role: aiMessages.role,
      text: aiMessages.text,
      images: aiMessages.images,
      toolCalls: aiMessages.toolCalls,
    })
    .from(aiMessages)
    .where(eq(aiMessages.conversationId, conversationId))
    .orderBy(aiMessages.createdAt)

  return rows as AgentMsg[]
}

const sendSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(1, 'اكتب رسالتك').max(3000),
  images: z.array(z.string().url()).max(6).optional(),
})

/**
 * رسالة للمساعد.
 *
 * دورة واحدة: الموديل يرد ويقترح إجراءات. **الإجراءات اللي بتغيّر
 * حاجة ما بتتنفّذش هنا** — بتترجع «مستنية موافقة». القراءة بتتنفّذ
 * فورًا وبترجع للموديل عشان يكمل كلامه على أساس بيانات حقيقية.
 */
export async function sendToAssistantAction(raw: unknown): Promise<AgentState> {
  const parsed = sendSchema.safeParse(raw)
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { store, user } = await getDashboardContext()
  const key = await resolveKey(store.id)
  if (!key.ok) return { ok: false, error: key.error, needsSetup: key.needsSetup }

  const pro = await getAiConfig(store.id, GEMINI_PRO_SLUG)

  // محادثة جديدة لو مفيش — عنوانها أول ٤٠ حرف من رسالته
  let conversationId = parsed.data.conversationId
  if (!conversationId) {
    const [created] = await db
      .insert(aiConversations)
      .values({
        storeId: store.id,
        userId: user.id,
        kind: 'assistant',
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
    images: parsed.data.images ?? [],
  })

  const system = await buildSystem(store.id, pro.brief, store.name)
  const history = await loadMessages(conversationId)

  /*
    حلقة قصيرة: الموديل يقرا، يشوف النتيجة، يقرا تاني لو محتاج.
    الحد ٤ لفّات — من غيره موديل متلخبط يفضل يقرا للأبد على حساب
    التاجر. الكتابة بتوقف الحلقة لأنها محتاجة موافقة.
  */
  const messages = toAgentMessages(history)
  let finalText = ''
  let pendingCalls: AiToolCall[] = []

  for (let round = 0; round < 4; round++) {
    const res = await agentTurn({
      apiKey: key.apiKey,
      model: key.model,
      system,
      messages,
      tools: AGENT_TOOLS,
    })

    if (!res.ok) {
      return { ok: false, error: res.error.message, needsSetup: res.error.kind === 'invalid_key' }
    }

    finalText = res.data.text || finalText
    if (res.data.calls.length === 0) break

    const writes = res.data.calls.filter((c) => getTool(c.name)?.kind === 'write')
    const reads = res.data.calls.filter((c) => getTool(c.name)?.kind !== 'write')

    messages.push({
      role: 'model',
      text: res.data.text || undefined,
      calls: res.data.calls,
    })

    // القراءة بتتنفّذ فورًا وبترجع للموديل
    for (const c of reads) {
      const result = await executeTool(store.id, store.currency, c)
      messages.push({
        role: 'tool',
        name: c.name,
        result: result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error },
      })
    }

    if (writes.length > 0) {
      pendingCalls = writes.map((c) => ({
        name: c.name,
        args: c.args,
        status: 'pending' as const,
      }))
      break
    }
  }

  await db.insert(aiMessages).values({
    conversationId,
    storeId: store.id,
    role: 'model',
    text: finalText,
    toolCalls: pendingCalls,
  })

  await db
    .update(aiConversations)
    .set({ updatedAt: new Date() })
    .where(eq(aiConversations.id, conversationId))

  return { ok: true, conversationId, messages: await loadMessages(conversationId) }
}

/**
 * موافقة أو رفض إجراء.
 *
 * **ده الحاجز الوحيد بين اقتراح الموديل وتغيير حقيقي في المتجر.**
 * التنفيذ هنا لا في الرد على الرسالة، عشان التاجر يكون شاف الإجراء
 * بالعربي قبل ما يحصل.
 */
export async function decideToolAction(input: {
  messageId: string
  index: number
  approve: boolean
}): Promise<AgentState> {
  const { store, user } = await getDashboardContext()

  const [msg] = await db
    .select({
      id: aiMessages.id,
      conversationId: aiMessages.conversationId,
      toolCalls: aiMessages.toolCalls,
    })
    .from(aiMessages)
    .where(and(eq(aiMessages.id, input.messageId), eq(aiMessages.storeId, store.id)))
    .limit(1)

  if (!msg) return { ok: false, error: 'الرسالة مش موجودة' }

  const calls = [...msg.toolCalls]
  const call = calls[input.index]
  if (!call) return { ok: false, error: 'الإجراء مش موجود' }
  if (call.status !== 'pending') {
    return { ok: false, error: 'الإجراء ده اتحسم قبل كده' }
  }

  if (!input.approve) {
    calls[input.index] = { ...call, status: 'rejected' }
  } else {
    const result = await executeTool(store.id, store.currency, {
      name: call.name,
      args: call.args,
    })

    calls[input.index] = result.ok
      ? { ...call, status: 'done', result: result.summary }
      : { ...call, status: 'failed', result: result.error }

    if (result.ok) {
      await recordAudit({
        storeId: store.id,
        userId: user.id,
        action: 'settings.update',
        resource: 'ai_assistant',
        resourceId: call.name,
        after: { tool: call.name, args: call.args, result: result.summary },
      })
    }
  }

  await db.update(aiMessages).set({ toolCalls: calls }).where(eq(aiMessages.id, msg.id))

  // اللوحة كلها ممكن تكون اتغيّرت — منتج جديد، سعر، حالة طلب
  revalidatePath('/dashboard', 'layout')

  return {
    ok: true,
    conversationId: msg.conversationId,
    messages: await loadMessages(msg.conversationId),
  }
}

export async function listConversationsAction() {
  const { store } = await getDashboardContext()

  return db
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      updatedAt: aiConversations.updatedAt,
    })
    .from(aiConversations)
    .where(
      and(
        eq(aiConversations.storeId, store.id),
        eq(aiConversations.kind, 'assistant'),
      ),
    )
    .orderBy(desc(aiConversations.updatedAt))
    .limit(30)
}

export async function loadConversationAction(id: string): Promise<AgentState> {
  const { store } = await getDashboardContext()

  const [own] = await db
    .select({ id: aiConversations.id })
    .from(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.storeId, store.id)))
    .limit(1)

  if (!own) return { ok: false, error: 'المحادثة مش موجودة' }
  return { ok: true, conversationId: id, messages: await loadMessages(id) }
}

export async function deleteConversationAction(id: string): Promise<{ ok: boolean }> {
  const { store } = await getDashboardContext()
  await db
    .delete(aiConversations)
    .where(and(eq(aiConversations.id, id), eq(aiConversations.storeId, store.id)))
  return { ok: true }
}
