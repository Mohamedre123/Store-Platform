import 'server-only'
import type { AgentMessage, AgentTurn, ChatMessage, InlineImage, ToolCall, ToolDef } from './gemini'
import { CREDIT_HELP } from './providers-meta'
import { asReferencePng, fitToAspect, fitToSize } from './image-fit'

/**
 * عميل OpenAI (ChatGPT).
 *
 * بالـREST مباشرة زي Gemini وClaude — من غير حزمة.
 *
 * **بمفتاح التاجر.** كل نداء بيتحاسب على حسابه هو عند OpenAI.
 *
 * ## ما اتجرّبش بمفتاح حقيقي وقت الكتابة
 * العقد مكتوب على توثيق OpenAI (Chat Completions والصور وSora). عشان
 * كده كل رفض بيرجع **بسببه الحقيقي** مترجمًا — مش «رد غير متوقّع» —
 * وأول تاجر يربط مفتاح هو اللي هيكشف أي فرق.
 */

const BASE = 'https://api.openai.com/v1'

export type OpenAiError = {
  kind: 'invalid_key' | 'no_credit' | 'quota' | 'blocked' | 'network' | 'unknown'
  message: string
}
export type OpenAiResult<T> = { ok: true; data: T } | { ok: false; error: OpenAiError }
export type OpenAiModel = { id: string; label: string }

class OpenAiTimeout extends Error {}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * نداء مع إعادة محاولة واحدة على أخطاء الخادم.
 *
 * **مفيش إعادة على المهلة.** الموديل اللي ما ردّش في ٣٠ ثانية مش
 * هيرد في التانية — وإعادته بتضيّع وقت العميل وبتدفع التاجر مرتين.
 */
async function call(
  path: string,
  apiKey: string,
  init: RequestInit & { timeoutMs?: number },
): Promise<Response> {
  const { timeoutMs = 30_000, headers, ...rest } = init

  for (let i = 0; i < 2; i++) {
    try {
      const res = await fetch(BASE + path, {
        ...rest,
        headers: { Authorization: `Bearer ${apiKey}`, ...((headers as Record<string, string>) ?? {}) },
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (res.status >= 500 && i === 0) {
        await sleep(700)
        continue
      }
      return res
    } catch (e) {
      if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        throw new OpenAiTimeout()
      }
      if (i === 0) {
        await sleep(700)
        continue
      }
      throw e
    }
  }

  throw new Error('network')
}

function netError(e: unknown): OpenAiError {
  if (e instanceof OpenAiTimeout) {
    return {
      kind: 'network',
      message: 'ChatGPT ما ردّش في الوقت. جرّب تاني، ولو تكرر اختار موديل أسرع (زي mini).',
    }
  }
  return { kind: 'network', message: 'مقدرناش نوصل لـOpenAI دلوقتي. جرّب بعد شوية.' }
}

/**
 * ترجمة رفض OpenAI.
 *
 * ## الـ429 نوعين والفرق حاسم
 * `insufficient_quota` معناه **مفيش رصيد** — الاستنّى مش هيصلّحه،
 * لازم يشحن. و`rate_limit_exceeded` معناه ضغط لحظي — دقيقة وبيعدّي.
 * جمعهم في رسالة واحدة كان هيخلّي اللي مالوش رصيد يستنّى على الفاضي.
 */
export function classify(status: number, body: string): OpenAiError {
  let code = ''
  let message = ''
  try {
    const parsed = JSON.parse(body) as { error?: { code?: string | null; type?: string; message?: string } }
    code = String(parsed.error?.code ?? parsed.error?.type ?? '')
    message = parsed.error?.message ?? ''
  } catch {
    /* مش JSON — بنكمّل بالنص */
  }
  const lower = `${code} ${message} ${body}`.toLowerCase()

  if (status === 401 || code === 'invalid_api_key') {
    return {
      kind: 'invalid_key',
      message: 'مفتاح ChatGPT غلط أو اتلغى. اعمل مفتاحًا جديدًا من platform.openai.com ← API keys.',
    }
  }
  if (lower.includes('insufficient_quota') || lower.includes('billing_hard_limit')) {
    return { kind: 'no_credit', message: CREDIT_HELP.openai }
  }
  if (status === 429) {
    return {
      kind: 'quota',
      message: 'فيه ضغط على مفتاح ChatGPT دلوقتي (حد الطلبات في الدقيقة). استنى دقيقة وجرّب تاني.',
    }
  }
  if (status === 403) {
    if (lower.includes('country') || lower.includes('region')) {
      return { kind: 'invalid_key', message: 'OpenAI مش بتسمح بالنداء من المنطقة دي.' }
    }
    if (lower.includes('verif')) {
      return {
        kind: 'invalid_key',
        message:
          'الموديل ده محتاج توثيق منظمتك عند OpenAI — من platform.openai.com ← Settings ← Organization ← Verify.',
      }
    }
    return { kind: 'invalid_key', message: 'مفتاح ChatGPT مش مسموح له بالموديل ده.' }
  }
  if (code === 'content_policy_violation' || lower.includes('safety system') || lower.includes('moderation')) {
    return { kind: 'blocked', message: 'الطلب اتمنع من فلاتر OpenAI. غيّر الصياغة وجرّب تاني.' }
  }
  if (status === 404 || code === 'model_not_found') {
    return { kind: 'unknown', message: 'الموديل ده مش متاح على مفتاح ChatGPT بتاعك (404).' }
  }
  if (status >= 500) {
    return { kind: 'network', message: 'خدمة OpenAI مش مستجيبة دلوقتي. جرّب بعد شوية.' }
  }

  return {
    kind: 'unknown',
    message: message
      ? `OpenAI رفض الطلب (${status}): ${message.slice(0, 200)}`
      : `رد غير متوقّع من OpenAI (${status}).`,
  }
}

/* ══════════════════ الموديلات ══════════════════ */

/**
 * أسماء الموديلات في ذاكرة الاستدعاء عشر دقايق.
 *
 * كل صورة وكل فيديو بيحتاجوا يعرفوا أنهي موديل متاح. سؤال OpenAI مع
 * كل واحدة كان هيضيف رحلة كاملة على كل توليد.
 */
const modelCache = new Map<string, { at: number; ids: string[] }>()

async function modelIds(apiKey: string): Promise<OpenAiResult<string[]>> {
  const hit = modelCache.get(apiKey)
  if (hit && Date.now() - hit.at < 600_000) return { ok: true, data: hit.ids }

  try {
    const res = await call('/models', apiKey, { timeoutMs: 15_000 })
    if (!res.ok) return { ok: false, error: classify(res.status, await res.text()) }

    const data = (await res.json()) as { data?: Array<{ id: string }> }
    const ids = (data.data ?? []).map((m) => m.id)
    modelCache.set(apiKey, { at: Date.now(), ids })
    return { ok: true, data: ids }
  } catch (e) {
    return { ok: false, error: netError(e) }
  }
}

/**
 * موديل كلام؟
 *
 * بالاستبعاد زي Gemini: OpenAI بتدرج صوت وتضمين وصور وفيديو ومراقبة
 * على نفس المفتاح. القايمة البيضا بتبقى قديمة مع أول إصدار جديد.
 */
function isChatModel(id: string): boolean {
  return (
    /^(gpt-|chatgpt-|o\d)/i.test(id) &&
    !/(audio|realtime|transcribe|tts|image|search|instruct|embedding|whisper|dall-e|moderation|codex|computer-use|sora|deep-research|babbage|davinci)/i.test(
      id,
    )
  )
}

function version(id: string): number {
  const m = id.match(/^(?:gpt|chatgpt|gpt-image)-(\d+(?:\.\d+)?)/i) ?? id.match(/^o(\d+)/i)
  return m ? Number(m[1]) : 0
}

/** الأحدث فوق، والكامل قبل mini قبل nano */
function byNewest(a: string, b: string): number {
  const tier = (id: string) => (/nano/i.test(id) ? 2 : /mini/i.test(id) ? 1 : 0)
  return version(b) - version(a) || tier(a) - tier(b) || a.localeCompare(b)
}

/** النسخ المؤرّخة بتتشال لو اسمها العام موجود — نفس الموديل مكرر خمس مرات */
function dropSnapshots(ids: string[]): string[] {
  const set = new Set(ids)
  return ids.filter((id) => {
    const alias = id.replace(/-\d{4}-\d{2}-\d{2}$/, '')
    return alias === id || !set.has(alias)
  })
}

function prettyLabel(id: string): string {
  return id
    .replace(/^gpt-image-/i, 'GPT Image ')
    .replace(/^gpt-/i, 'GPT-')
    .replace(/^chatgpt-/i, 'ChatGPT-')
    .replace(/-(mini|nano|pro|turbo|chat|latest)/gi, ' $1')
}

export async function listModels(
  apiKey: string,
): Promise<OpenAiResult<{ chat: OpenAiModel[]; image: OpenAiModel[]; video: string[] }>> {
  const ids = await modelIds(apiKey)
  if (!ids.ok) return ids

  const clean = dropSnapshots(ids.data)
  const toModel = (id: string) => ({ id, label: prettyLabel(id) })

  return {
    ok: true,
    data: {
      chat: clean.filter(isChatModel).sort(byNewest).map(toModel),
      image: clean.filter((id) => /^gpt-image/i.test(id)).sort(byNewest).map(toModel),
      video: clean.filter((id) => /^sora/i.test(id)).sort(byNewest),
    },
  }
}

/**
 * الموديل الافتراضي — سريع ورخيص وبيدعم الأدوات.
 *
 * موديلات «التفكير» (o وGPT-5) أبطأ بكتير على بوت بيرد على عميل
 * واقف مستنّي، فبتيجي بعد الموديلات السريعة في الترتيب.
 */
export function pickDefaultModel(models: OpenAiModel[]): string | null {
  const ids = models.map((m) => m.id)
  const preferred = ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-5-mini', 'gpt-4.1', 'gpt-4o']
  return preferred.find((p) => ids.includes(p)) ?? ids[0] ?? null
}

/** موديلات التفكير بترفض `temperature` وبتصرف توكنز على التفكير قبل الرد */
function isReasoning(model: string): boolean {
  return /^(o\d|gpt-5)/i.test(model) && !/chat/i.test(model)
}

/* ══════════════════ الكلام والأدوات ══════════════════ */

type OaMessage =
  | { role: 'system' | 'user'; content: string | Array<Record<string, unknown>> }
  | {
      role: 'assistant'
      content: string | null
      tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }>
    }
  | { role: 'tool'; tool_call_id: string; content: string }

/** أنواع JSON Schema بحروف صغيرة — OpenAI بترفض `STRING` اللي Gemini بتقبله */
function lowerTypes(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(lowerTypes)
  if (v && typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v).map(([k, val]) => [
        k,
        k === 'type' && typeof val === 'string' ? val.toLowerCase() : lowerTypes(val),
      ]),
    )
  }
  return v
}

/**
 * الأداة بالشكل اللي OpenAI بتقبله.
 *
 * بناخد الاسم والوصف والمعاملات بس. تعريفات الأدوات عندنا فيها حقول
 * داخلية (`kind` و`describe`) — ونفس الدرس اللي اتعلّمناه مع Gemini:
 * أي حقل زيادة بيترفض الطلب كله.
 */
function toOpenAiTool(t: ToolDef) {
  const params = lowerTypes(t.parameters ?? { type: 'object', properties: {} }) as {
    properties?: Record<string, unknown>
    required?: string[]
  }
  return {
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: 'object',
        properties: params.properties ?? {},
        ...(params.required?.length ? { required: params.required } : {}),
      },
    },
  }
}

/**
 * سجل المحادثة بصيغة OpenAI.
 *
 * ## كل نداء أداة لازم يترد عليه بمعرّفه
 * OpenAI بترفض الطلب كله لو رسالة فيها `tool_calls` مش متبوعة برد لكل
 * معرّف. والمحادثات القديمة المحفوظة عندنا (من أيام Gemini) مالهاش
 * معرّفات أصلًا — فبنولّد معرّفًا ثابتًا للنداء ونربط النتيجة بيه
 * بالاسم بالترتيب. والنداء اللي مالوش نتيجة بياخد رد «مفيش نتيجة»
 * بدل ما يوقّع المحادثة.
 */
function toOpenAiMessages(system: string, messages: AgentMessage[]): OaMessage[] {
  const out: OaMessage[] = [{ role: 'system', content: system }]
  let pending: Array<{ id: string; name: string }> = []

  const flush = () => {
    for (const p of pending) {
      out.push({ role: 'tool', tool_call_id: p.id, content: JSON.stringify({ ok: false, error: 'مفيش نتيجة' }) })
    }
    pending = []
  }

  messages.forEach((m, mi) => {
    if (m.role === 'user') {
      flush()
      const images = m.images ?? []
      out.push({
        role: 'user',
        content: images.length
          ? [
              { type: 'text', text: m.text },
              ...images.map((img) => ({
                type: 'image_url',
                image_url: { url: `data:${img.mimeType};base64,${img.dataBase64}` },
              })),
            ]
          : m.text,
      })
      return
    }

    if (m.role === 'model') {
      flush()
      const calls = (m.calls ?? []).map((c, ci) => ({ ...c, id: c.id ?? `call_${mi}_${ci}` }))
      if (!m.text && calls.length === 0) return

      out.push({
        role: 'assistant',
        /* `null` لا نص فاضي — ده الشكل اللي OpenAI بتتوقعه مع `tool_calls` */
        content: m.text || null,
        ...(calls.length
          ? {
              tool_calls: calls.map((c) => ({
                id: c.id,
                type: 'function' as const,
                function: { name: c.name, arguments: JSON.stringify(c.args ?? {}) },
              })),
            }
          : {}),
      })
      pending = calls.map((c) => ({ id: c.id, name: c.name }))
      return
    }

    const at = pending.findIndex((p) => p.name === m.name)
    if (at === -1) return
    const [p] = pending.splice(at, 1)
    out.push({ role: 'tool', tool_call_id: p.id, content: JSON.stringify(m.result) })
  })

  flush()
  return out
}

type CompleteInput = {
  apiKey: string
  model: string
  messages: OaMessage[]
  maxTokens?: number
  temperature?: number
  tools?: ToolDef[]
  /** رد JSON — للمصمّم */
  json?: boolean
  timeoutMs?: number
}

type Completion = { text: string; calls: ToolCall[]; model: string }

/**
 * نداء Chat Completions.
 *
 * ## الحقول بتتشال لو الموديل رفضها
 * موديلات التفكير بترفض `temperature`، وبعض القديمة بترفض
 * `reasoning_effort`. بدل ما التاجر يشوف ٤٠٠ ويقف، بنشيل الحقل اللي
 * الرد سمّاه ونعيد — نفس الحيلة اللي شغّالة مع Claude.
 *
 * ## والموديل الممسوح بيرجع لبديل
 * لو التاجر محفوظ عنده موديل OpenAI شالته، بنجيب القايمة من مفتاحه
 * ونجرّب الافتراضي مرة واحدة.
 */
async function complete(input: CompleteInput, allowFallback = true): Promise<OpenAiResult<Completion>> {
  const reasoning = isReasoning(input.model)
  const wanted = input.maxTokens ?? 800

  const payload: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    /*
      موديلات التفكير بتصرف من نفس الحد على التفكير قبل ما تكتب. بحد
      ٨٠٠ كانت هترجّع رد فاضي — فبنوسّعه ليها بس.
    */
    max_completion_tokens: reasoning ? Math.max(wanted * 4, 4000) : wanted,
  }
  if (reasoning) payload.reasoning_effort = 'low'
  else if (input.temperature !== undefined) payload.temperature = input.temperature
  if (input.tools?.length) payload.tools = input.tools.map(toOpenAiTool)
  if (input.json) payload.response_format = { type: 'json_object' }

  try {
    let res: Response | null = null

    for (let attempt = 0; attempt < 4; attempt++) {
      res = await call('/chat/completions', input.apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        timeoutMs: input.timeoutMs ?? (reasoning ? 60_000 : 30_000),
      })
      if (res.status !== 400) break

      const body = (await res.clone().text()).toLowerCase()
      const offending = ['temperature', 'reasoning_effort', 'response_format', 'max_completion_tokens'].find(
        (f) => f in payload && body.includes(f),
      )
      if (!offending) break

      if (offending === 'max_completion_tokens') {
        payload.max_tokens = payload.max_completion_tokens
      }
      delete payload[offending]
    }

    if (!res) return { ok: false, error: { kind: 'network', message: 'مقدرناش نوصل لـOpenAI.' } }

    if (!res.ok) {
      const body = await res.text()
      const error = classify(res.status, body)

      if (allowFallback && (res.status === 404 || /model_not_found/i.test(body))) {
        const list = await listModels(input.apiKey)
        const fallback = list.ok ? pickDefaultModel(list.data.chat) : null
        if (fallback && fallback !== input.model) {
          return complete({ ...input, model: fallback }, false)
        }
      }
      return { ok: false, error }
    }

    const data = (await res.json()) as {
      model?: string
      choices?: Array<{
        finish_reason?: string
        message?: {
          content?: string | null
          refusal?: string | null
          tool_calls?: Array<{ id: string; function?: { name?: string; arguments?: string } }>
        }
      }>
    }

    const choice = data.choices?.[0]
    const msg = choice?.message

    if (msg?.refusal) {
      return { ok: false, error: { kind: 'blocked', message: 'ChatGPT رفض الطلب ده. غيّر الصياغة وجرّب تاني.' } }
    }

    const calls: ToolCall[] = (msg?.tool_calls ?? [])
      .filter((c) => c.function?.name)
      .map((c) => {
        let args: Record<string, unknown> = {}
        try {
          args = JSON.parse(c.function?.arguments || '{}') as Record<string, unknown>
        } catch {
          /* وسايط مكسورة — الأداة بترفضها بسببها بدل ما المحادثة كلها تقع */
        }
        return { id: c.id, name: c.function!.name!, args }
      })

    const text = (msg?.content ?? '').trim()

    if (!text && calls.length === 0) {
      return {
        ok: false,
        error: {
          kind: 'unknown',
          message:
            choice?.finish_reason === 'length'
              ? 'رد ChatGPT اتقطع قبل ما يكتب. اختار موديل أسرع (زي mini) أو قلّل الطلب.'
              : 'ChatGPT رجّع رد فاضي. جرّب تاني.',
        },
      }
    }

    return { ok: true, data: { text, calls, model: data.model ?? input.model } }
  } catch (e) {
    return { ok: false, error: netError(e) }
  }
}

/** توليد نص — نفس شكل `gemini.generate` */
export async function generate(input: {
  apiKey: string
  model: string
  system?: string
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
  json?: boolean
  timeoutMs?: number
}): Promise<OpenAiResult<string>> {
  const messages: OaMessage[] = [
    ...(input.system ? [{ role: 'system' as const, content: input.system }] : []),
    ...input.messages.map((m): OaMessage =>
      m.role === 'model' ? { role: 'assistant', content: m.text } : { role: 'user', content: m.text },
    ),
  ]

  const res = await complete({
    apiKey: input.apiKey,
    model: input.model,
    messages,
    maxTokens: input.maxTokens,
    temperature: input.temperature,
    json: input.json,
    timeoutMs: input.timeoutMs,
  })
  return res.ok ? { ok: true, data: res.data.text } : res
}

/** دورة وكيل — نفس شكل `gemini.agentTurn` */
export async function agentTurn(input: {
  apiKey: string
  model: string
  system: string
  messages: AgentMessage[]
  tools: ToolDef[]
  maxTokens?: number
}): Promise<OpenAiResult<AgentTurn>> {
  const res = await complete({
    apiKey: input.apiKey,
    model: input.model,
    messages: toOpenAiMessages(input.system, input.messages),
    tools: input.tools,
    maxTokens: input.maxTokens ?? 1200,
    /* الوكيل بينفّذ إجراءات — الدقة أهم من التنوّع */
    temperature: 0.2,
    timeoutMs: 25_000,
  })
  return res.ok ? { ok: true, data: { text: res.data.text, calls: res.data.calls } } : res
}

/**
 * التحقق من المفتاح — ومن الرصيد.
 *
 * ## قايمة الموديلات بتشتغل من غير رصيد
 * المفتاح الصحيح اللي حسابه صفر بيرجّع الموديلات عادي، والتاجر بيحفظه
 * فرحان — وأول عميل يسأل البوت ما بيردّش. فبعد القايمة بنعمل نداء
 * صغير (كلمة واحدة) عشان «مالوش رصيد» تبان **وقت الحفظ** مش قدام عميل.
 */
export async function verifyKey(
  apiKey: string,
): Promise<OpenAiResult<{ models: OpenAiModel[]; suggested: string; warning?: string }>> {
  const list = await listModels(apiKey)
  if (!list.ok) return list

  if (list.data.chat.length === 0) {
    return { ok: false, error: { kind: 'invalid_key', message: 'المفتاح شغّال بس مفيش موديلات كلام متاحة عليه.' } }
  }

  const suggested = pickDefaultModel(list.data.chat)!
  const probe = await generate({
    apiKey,
    model: suggested,
    messages: [{ role: 'user', text: 'رد بكلمة واحدة: تمام' }],
    maxTokens: 16,
    timeoutMs: 20_000,
  })

  let warning: string | undefined
  if (!probe.ok && probe.error.kind !== 'unknown' && probe.error.kind !== 'network') {
    warning = probe.error.message
  }

  return { ok: true, data: { models: list.data.chat, suggested, warning } }
}

/* ══════════════════ الصور ══════════════════ */

/** أقرب مقاس بتدعمه موديلات الصور — والقصّ بعدها بيوصل للنسبة بالظبط */
function imageSize(aspect: string): string {
  const [w, h] = aspect.split(':').map(Number)
  if (!w || !h || w === h) return '1024x1024'
  return w > h ? '1536x1024' : '1024x1536'
}

/**
 * توليد صورة أو تعديلها بموديل gpt-image.
 *
 * لو فيه صور مرجعية بتروح لـ`/images/edits` (المنتج الحقيقي بيتبني
 * عليها)، ولو مفيش بتروح لـ`/images/generations`. والناتج بيتقصّ
 * لنسبة المنصة بالظبط.
 */
export async function generateImage(input: {
  apiKey: string
  model?: string | null
  prompt: string
  images?: InlineImage[]
  aspect: string
}): Promise<OpenAiResult<{ mimeType: string; dataBase64: string; model: string }>> {
  let model = input.model ?? null
  if (!model) {
    const list = await listModels(input.apiKey)
    if (!list.ok) return list
    model = list.data.image[0]?.id ?? null
  }
  if (!model) {
    return {
      ok: false,
      error: {
        kind: 'invalid_key',
        message:
          'حساب ChatGPT ده مالوش موديل صور (gpt-image). الموديل ده محتاج توثيق منظمتك عند OpenAI — ' +
          'من platform.openai.com ← Settings ← Organization ← Verify.',
      },
    }
  }

  const size = imageSize(input.aspect)
  const refs = input.images ?? []

  try {
    const send = async (withQuality: boolean): Promise<Response> => {
      if (refs.length) {
        const form = new FormData()
        form.append('model', model!)
        form.append('prompt', input.prompt)
        form.append('size', size)
        if (withQuality) form.append('quality', 'high')
        for (let i = 0; i < refs.length; i++) {
          const png = await asReferencePng(Buffer.from(refs[i].dataBase64, 'base64'))
          form.append('image[]', new Blob([new Uint8Array(png)], { type: 'image/png' }), `reference-${i + 1}.png`)
        }
        return call('/images/edits', input.apiKey, { method: 'POST', body: form, timeoutMs: 180_000 })
      }

      return call('/images/generations', input.apiKey, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, prompt: input.prompt, size, n: 1, ...(withQuality ? { quality: 'high' } : {}) }),
        timeoutMs: 180_000,
      })
    }

    let res = await send(true)
    if (res.status === 400 && (await res.clone().text()).toLowerCase().includes('quality')) {
      res = await send(false)
    }
    if (!res.ok) return { ok: false, error: classify(res.status, await res.text()) }

    const data = (await res.json()) as { data?: Array<{ b64_json?: string }> }
    const b64 = data.data?.[0]?.b64_json
    if (!b64) return { ok: false, error: { kind: 'unknown', message: 'OpenAI ما رجّعتش صورة.' } }

    const fitted = await fitToAspect(Buffer.from(b64, 'base64'), input.aspect)
    return {
      ok: true,
      data: { mimeType: fitted.mimeType, dataBase64: fitted.buffer.toString('base64'), model },
    }
  } catch (e) {
    return { ok: false, error: netError(e) }
  }
}

/* ══════════════════ الفيديو (Sora) ══════════════════ */

/**
 * بدء فيديو Sora — بيرجّع معرّف المهمة.
 *
 * نفس نموذج Veo: بداية وسؤال متكرر، لأن التوليد بياخد دقايق.
 */
export async function startVideo(input: {
  apiKey: string
  prompt: string
  aspect: '16:9' | '9:16'
  image?: InlineImage
}): Promise<OpenAiResult<string>> {
  const list = await listModels(input.apiKey)
  if (!list.ok) return list
  const model = list.data.video.includes('sora-2') ? 'sora-2' : (list.data.video[0] ?? 'sora-2')

  const [w, h] = input.aspect === '16:9' ? [1280, 720] : [720, 1280]

  try {
    const form = new FormData()
    form.append('model', model)
    form.append('prompt', input.prompt)
    form.append('size', `${w}x${h}`)
    form.append('seconds', '8')
    if (input.image) {
      /* Sora بيرفض المرجع اللي مقاسه مش نفس الفيديو بالظبط */
      const ref = await fitToSize(Buffer.from(input.image.dataBase64, 'base64'), w, h)
      form.append('input_reference', new Blob([new Uint8Array(ref)], { type: 'image/jpeg' }), 'reference.jpg')
    }

    const res = await call('/videos', input.apiKey, { method: 'POST', body: form, timeoutMs: 60_000 })
    if (!res.ok) {
      const error = classify(res.status, await res.text())
      if (error.kind === 'unknown' && res.status === 404) {
        error.message = 'حساب ChatGPT ده مالوش Sora. الفيديو محتاج توثيق منظمتك عند OpenAI.'
      }
      return { ok: false, error }
    }

    const data = (await res.json()) as { id?: string }
    if (!data.id) return { ok: false, error: { kind: 'unknown', message: 'OpenAI ما رجّعتش معرّف الفيديو.' } }
    return { ok: true, data: data.id }
  } catch (e) {
    return { ok: false, error: netError(e) }
  }
}

export async function checkVideo(
  apiKey: string,
  id: string,
): Promise<OpenAiResult<{ state: 'running' } | { state: 'done' } | { state: 'failed'; message: string }>> {
  try {
    const res = await call(`/videos/${encodeURIComponent(id)}`, apiKey, { timeoutMs: 20_000 })
    if (!res.ok) return { ok: false, error: classify(res.status, await res.text()) }

    const data = (await res.json()) as { status?: string; error?: { message?: string } | null }
    if (data.status === 'completed') return { ok: true, data: { state: 'done' } }
    if (data.status === 'failed') {
      return { ok: true, data: { state: 'failed', message: data.error?.message ?? 'Sora فشل في التوليد' } }
    }
    return { ok: true, data: { state: 'running' } }
  } catch (e) {
    return { ok: false, error: netError(e) }
  }
}

export async function downloadVideo(apiKey: string, id: string): Promise<OpenAiResult<Buffer>> {
  try {
    const res = await call(`/videos/${encodeURIComponent(id)}/content`, apiKey, { timeoutMs: 120_000 })
    if (!res.ok) return { ok: false, error: classify(res.status, await res.text()) }
    return { ok: true, data: Buffer.from(await res.arrayBuffer()) }
  } catch (e) {
    return { ok: false, error: netError(e) }
  }
}
