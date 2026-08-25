import 'server-only'

/**
 * عميل Gemini.
 *
 * بالـREST مباشرة من غير حزمة — زي ما عملنا مع Resend. الحزمة كانت
 * هتضيف اعتمادًا وحجمًا مقابل غلاف على نداء واحد.
 *
 * **المفتاح بتاع التاجر لا بتاعنا.** كل نداء بيتحاسب على حسابه هو،
 * وإحنا مش شايلين فاتورة مفتوحة على استهلاك مش بتاعنا.
 */

const BASE = 'https://generativelanguage.googleapis.com/v1beta'

/**
 * نداء مع إعادة محاولة على أخطاء الخادم.
 *
 * جوجل بترجّع ٥٠٠ و٥٠٣ بشكل متقطّع — خصوصًا على موديلات المعاينة.
 * ده اللي كان بيخلّي البوت يرد على رسالة ويفشل في اللي بعدها بنفس
 * المفتاح ونفس السؤال. إعادة محاولتين بتباعد قصير بتخفي التقطّع ده
 * تمامًا عن العميل.
 *
 * **بنعيد على ٥xx بس.** المفتاح الباطل والكوته الخالصة مش هيتصلّحوا
 * بإعادة المحاولة — إعادتهم بتضيّع وقت العميل وبتستهلك حصّة التاجر.
 */
/**
 * مهلة النداء الواحد.
 *
 * **كانت ٤٥ ثانية، وده أطول من عمر الاستدعاء نفسه.** المساعد المنفّذ
 * بيلفّ لحد ٤ لفّات على الموديل، ودالة على المضيف عمرها ٦٠ ثانية —
 * فأول نداء بطيء كان بياكل المهلة كلها، والاستدعاء بيموت قبل ما
 * المهلة نفسها تفوق.
 *
 * ٢٠ ثانية بتخلّي لفّتين يعدّوا جوّه السقف، وبتدّي مجالًا لإعادة
 * محاولة لو جوجل اتقطّعت.
 */
const CALL_TIMEOUT_MS = 20_000

/** خطأ المهلة — بيتلفّ في نوع نعرفه بدل ما يطلع بنصّه الإنجليزي */
export class GeminiTimeout extends Error {
  constructor() {
    super('جوجل ما ردّتش في الوقت. جرّب تاني، ولو تكرر قلّل حجم الطلب.')
    this.name = 'GeminiTimeout'
  }
}

async function callWithRetry(url: string, init: RequestInit, attempts = 3): Promise<Response> {
  let last: Response | null = null
  let timedOut = false

  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, {
        ...init,
        cache: 'no-store',
        signal: AbortSignal.timeout(CALL_TIMEOUT_MS),
      })
      if (res.status < 500) return res
      last = res
    } catch (e) {
      /*
        `AbortSignal.timeout` بترمي `TimeoutError` — وهي كانت بتعدّي
        من غير ما حد يمسكها، فالتاجر كان بيشوف
        «TimeoutError: The operation was aborted due to timeout»
        بالإنجليزي في وش المحادثة العربية.

        الانقطاع المؤقت بيستاهل محاولة تانية زي الـ٥xx بالظبط.
      */
      if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
        timedOut = true
      } else {
        throw e
      }
    }

    if (i < attempts - 1) await new Promise((r) => setTimeout(r, 400 * (i + 1)))
  }

  if (last) return last
  if (timedOut) throw new GeminiTimeout()
  throw new Error('فشل الاتصال بجوجل')
}

/**
 * ترجمة الاستثناء لرسالة التاجر.
 *
 * كان بيترمي نصّ الاستثناء زي ما هو، فالتاجر بيشوف إنجليزي تقني
 * («TimeoutError: The operation was aborted…») في نص محادثة عربية —
 * وما بيعرفش ده عطل عنده ولا عندنا ولا عند جوجل.
 */
function networkError(e: unknown): GeminiError {
  if (e instanceof GeminiTimeout) return { kind: 'network', message: e.message }
  if (e instanceof Error && (e.name === 'TimeoutError' || e.name === 'AbortError')) {
    return { kind: 'network', message: new GeminiTimeout().message }
  }
  return { kind: 'network', message: 'مقدرناش نوصل لجوجل دلوقتي. جرّب تاني بعد شوية.' }
}

export type GeminiError =
  | { kind: 'invalid_key'; message: string }
  | { kind: 'quota'; message: string }
  | { kind: 'blocked'; message: string }
  | { kind: 'network'; message: string }
  | { kind: 'unknown'; message: string }

export type GeminiResult<T> = { ok: true; data: T } | { ok: false; error: GeminiError }

/**
 * ترجمة خطأ المزوّد لرسالة التاجر يفهمها.
 *
 * «فشل الاتصال» مش معلومة يتصرّف على أساسها. «مفتاحك خلص رصيده» أو
 * «المفتاح باطل» بيقولوا له يعمل إيه بالظبط.
 */
function classify(status: number, body: string): GeminiError {
  const lower = body.toLowerCase()

  if (status === 400 && lower.includes('api key not valid')) {
    return { kind: 'invalid_key', message: 'المفتاح غلط. راجعه من Google AI Studio.' }
  }
  if (status === 401 || status === 403) {
    return {
      kind: 'invalid_key',
      message: 'المفتاح مرفوض — يا إما باطل يا إما مقفول على مشروع تاني.',
    }
  }
  if (status === 429) {
    return {
      kind: 'quota',
      message: 'خلصت حصّتك على المفتاح ده. استنى شوية أو فعّل الفوترة في Google AI Studio.',
    }
  }
  if (lower.includes('safety') || lower.includes('blocked')) {
    return { kind: 'blocked', message: 'المحتوى اتمنع من فلاتر جوجل. غيّر الصياغة وجرّب تاني.' }
  }
  if (status >= 500) {
    return { kind: 'network', message: 'خدمة جوجل مش مستجيبة دلوقتي. جرّب بعد شوية.' }
  }
  /*
    السبب الحقيقي بيتقال، ما بيتبلعش.

    «رد غير متوقّع (400)» ما بيقولش لا للتاجر ولا لينا حاجة، والرد
    الأصلي من جوجل بيبقى فيه السبب حرفيًا («أول رسالة لازم تكون من
    المستخدم»، «حقل مش معروف»...). كنا بنرميه ونسيب الاتنين يخمّنوا.

    بنقصّه: الرد ممكن يبقى صفحة HTML كاملة، ورسالة بألف حرف مش رسالة.
  */
  const reason = extractReason(body)
  return {
    kind: 'unknown',
    message: reason
      ? `جوجل رفض الطلب (${status}): ${reason}`
      : `رد غير متوقّع من جوجل (${status}).`,
  }
}

/** بيطلّع نص الخطأ من رد جوجل مهما كان شكله */
function extractReason(body: string): string | null {
  try {
    const parsed = JSON.parse(body) as { error?: { message?: string } }
    const msg = parsed.error?.message?.trim()
    if (msg) return msg.slice(0, 200)
  } catch {
    /* مش JSON — بنكمّل تحت */
  }
  const text = body.trim()
  return text && !text.startsWith('<') ? text.slice(0, 200) : null
}

export type GeminiModel = {
  id: string
  label: string
  /** بيدعم توليد نص؟ الموديلات اللي للتضمين بس مش بتنفع هنا */
  usable: boolean
}

/**
 * الموديلات المتاحة **للمفتاح ده** — بتتجاب من جوجل لا من قايمة مكتوبة عندنا.
 *
 * أي قايمة نكتبها بتبقى قديمة بعد شهرين، والتاجر يلاقي موديل مذكور
 * ومش شغّال. وكمان المفاتيح مش كلها ليها نفس الصلاحيات — فالقايمة
 * بتختلف من مفتاح لمفتاح أصلًا.
 */
export async function listModels(apiKey: string): Promise<GeminiResult<GeminiModel[]>> {
  try {
    const res = await callWithRetry(`${BASE}/models?key=${encodeURIComponent(apiKey)}&pageSize=100`, {})

    if (!res.ok) return { ok: false, error: classify(res.status, await res.text()) }

    const data = (await res.json()) as {
      models?: Array<{
        name: string
        displayName?: string
        supportedGenerationMethods?: string[]
      }>
    }

    const models = (data.models ?? [])
      .map((m) => {
        const id = m.name.replace(/^models\//, '')
        return {
          id,
          label: m.displayName ?? id,
          usable: (m.supportedGenerationMethods ?? []).includes('generateContent'),
        }
      })
      .filter((m) => m.usable)
      // الأحدث فوق: جوجل بتسمّي بالإصدار، والترتيب العكسي بيقرّب الجديد
      .sort((a, b) => rank(b.id) - rank(a.id) || b.id.localeCompare(a.id))

    return { ok: true, data: models }
  } catch (e) {
    return { ok: false, error: networkError(e) }
  }
}

/**
 * ترتيب تقريبي للأحدثية.
 *
 * بنقرا رقم الإصدار من الاسم بدل ما نكتب قايمة أسماء. لما جوجل تطلع
 * إصدارًا جديدًا، بيطلع فوق لوحده من غير ما نعدّل سطر.
 */
function rank(id: string): number {
  const version = Number(id.match(/gemini-(\d+(?:\.\d+)?)/)?.[1] ?? 0)
  // الاختبارية والقديمة تحت حتى لو رقمها أعلى
  const penalty = /preview|exp|deprecated|-8b|latest/.test(id) ? -0.5 : 0
  return version + penalty
}

/** أنسب موديل افتراضي: الأحدث اللي فيه «flash» — أسرع وأرخص للتحسين */
export function pickDefaultModel(models: GeminiModel[]): string | null {
  return models.find((m) => m.id.includes('flash'))?.id ?? models[0]?.id ?? null
}

export type ChatMessage = { role: 'user' | 'model'; text: string }

/**
 * نداء توليد.
 *
 * `system` بيتبعت كتعليمات نظام منفصلة لا كأول رسالة: كده الموديل
 * بيفرّق بين تعليماتنا وكلام العميل، وأصعب على العميل إنه يقنعه
 * يتجاهلها.
 */
export async function generate(input: {
  apiKey: string
  model: string
  system?: string
  messages: ChatMessage[]
  maxTokens?: number
  temperature?: number
}): Promise<GeminiResult<string>> {
  try {
    const res = await callWithRetry(
      `${BASE}/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: input.messages.map((m) => ({
            role: m.role,
            parts: [{ text: m.text }],
          })),
          ...(input.system
            ? { systemInstruction: { parts: [{ text: input.system }] } }
            : {}),
          generationConfig: {
            maxOutputTokens: input.maxTokens ?? 800,
            temperature: input.temperature ?? 0.8,
          },
        }),
      },
    )

    if (!res.ok) return { ok: false, error: classify(res.status, await res.text()) }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
        finishReason?: string
      }>
      promptFeedback?: { blockReason?: string }
    }

    if (data.promptFeedback?.blockReason) {
      return {
        ok: false,
        error: { kind: 'blocked', message: 'الطلب اتمنع من فلاتر جوجل.' },
      }
    }

    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''

    if (!text.trim()) {
      return { ok: false, error: { kind: 'unknown', message: 'جوجل رجّعت رد فاضي.' } }
    }

    return { ok: true, data: text.trim() }
  } catch (e) {
    return { ok: false, error: networkError(e) }
  }
}

/**
 * التحقق من المفتاح.
 *
 * **بنداء حقيقي لا بشكل المفتاح.** مفاتيح جوجل مش كلها بتبدأ بنفس
 * الحروف — فيه اللي بيبدأ بـAI وفيه AQ وغيرهم، والقايمة بتتغيّر.
 * أي فحص بالشكل هيرفض مفاتيح سليمة، والتاجر يفضل يحاول ومش فاهم.
 */
export async function verifyKey(
  apiKey: string,
): Promise<GeminiResult<{ models: GeminiModel[]; suggested: string }>> {
  const res = await listModels(apiKey)
  if (!res.ok) return res

  if (res.data.length === 0) {
    return {
      ok: false,
      error: { kind: 'invalid_key', message: 'المفتاح شغّال بس مفيش موديلات متاحة عليه.' },
    }
  }

  return { ok: true, data: { models: res.data, suggested: pickDefaultModel(res.data)! } }
}

/* ══════════════════ استدعاء الدوال ══════════════════ */

/**
 * تعريف أداة للموديل.
 *
 * `parameters` بصيغة JSON Schema المبسّطة اللي جوجل بتقبلها — أنواع
 * وأوصاف بس، من غير مراجع ولا تركيبات. أي حاجة أعقد بتترفض بخطأ
 * ٤٠٠ غامض، فبنخليها بسيطة عن قصد.
 */
export type ToolDef = {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, { type: string; description: string; enum?: string[] }>
    required?: string[]
  }
}

/**
 * نداء أداة من الموديل.
 *
 * `thoughtSignature` توقيع بيرجّعه الموديل مع كل نداء أداة، ولازم
 * **يترجّع له زي ما هو** لما نبعت سجل المحادثة تاني. من غيره
 * موديلات جيميني ٣ بترفض الطلب كله:
 *
 *   Function call is missing a thought_signature in functionCall parts
 *
 * كنا بنقرا الاسم والوسايط بس ونرمي التوقيع، فأول ما التاجر يسأل
 * سؤالًا محتاج أداة والمحادثة تكمّل، الرد التاني بيترفض. والتاجر
 * كان بيشوف «رد غير متوقّع (400)» ومش عارف السبب.
 *
 * إحنا مش بنفسّره ولا بنقراه — بنمرّره زي ما هو.
 */
export type ToolCall = {
  name: string
  args: Record<string, unknown>
  thoughtSignature?: string
}

/**
 * تنظيف تعريف الأداة قبل ما يتبعت.
 *
 * **ده كان سبب خطأ ٤٠٠ اللي بيوقّف المساعد كله.** تعريفات الأدوات
 * عندنا فيها حقول داخلية (`kind` بيفرّق بين القراءة والكتابة،
 * و`describe` بيكتب وصف الإجراء للتاجر). `describe` دالة فبتختفي
 * في التحويل لـJSON، لكن `kind` نصّ فبيتسرّب — وجوجل بترفض أي حقل
 * مش من حقولها وبترجّع ٤٠٠ قبل ما تقرا الرسالة أصلًا.
 *
 * والأداة اللي مالهاش معاملات بنشيل `parameters` منها خالص بدل ما
 * نبعت كائنًا فاضيًا — الكائن الفاضي بيترفض كمان.
 */
function cleanTool(t: ToolDef) {
  const params = t.parameters
  const hasProps = Object.keys(params?.properties ?? {}).length > 0

  return {
    name: t.name,
    description: t.description,
    ...(hasProps
      ? {
          parameters: {
            type: params.type,
            properties: params.properties,
            ...(params.required?.length ? { required: params.required } : {}),
          },
        }
      : {}),
  }
}

/** صورة مرفقة — بتتبعت للموديل عشان يفهم المنتج من صورته */
export type InlineImage = { mimeType: string; dataBase64: string }

export type AgentTurn = {
  /** كلام الموديل للتاجر */
  text: string
  /** الأدوات اللي طلب ينفّذها */
  calls: ToolCall[]
}

type Part =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } }
  | { functionCall: { name: string; args: Record<string, unknown> }; thoughtSignature?: string }
  | { functionResponse: { name: string; response: Record<string, unknown> } }

export type AgentMessage =
  | { role: 'user'; text: string; images?: InlineImage[] }
  | { role: 'model'; text?: string; calls?: ToolCall[] }
  | { role: 'tool'; name: string; result: Record<string, unknown> }

function toParts(m: AgentMessage): Part[] {
  if (m.role === 'user') {
    const parts: Part[] = []
    if (m.text) parts.push({ text: m.text })
    for (const img of m.images ?? []) {
      parts.push({ inlineData: { mimeType: img.mimeType, data: img.dataBase64 } })
    }
    return parts
  }

  if (m.role === 'model') {
    const parts: Part[] = []
    if (m.text) parts.push({ text: m.text })
    for (const c of m.calls ?? []) {
      parts.push({
        functionCall: { name: c.name, args: c.args },
        /* التوقيع بيترجّع زي ما هو — من غيره الطلب بيترفض */
        ...(c.thoughtSignature ? { thoughtSignature: c.thoughtSignature } : {}),
      })
    }
    return parts
  }

  return [{ functionResponse: { name: m.name, response: m.result } }]
}

/**
 * تنضيف سجل المحادثة قبل ما يتبعت.
 *
 * جوجل بترفض الطلب كله (٤٠٠) في حالتين بيحصلوا فعلًا عندنا:
 *
 * 1. **رسالة بلا أجزاء.** كنا بنبعت `{ text: '' }` كبديل، والجزء
 *    الفاضي مرفوض. الرسالة اللي مالهاش محتوى بتتشال أصلح.
 *
 * 2. **المحادثة مش بادئة برسالة مستخدم.** بيحصل لما التاجر يفتح
 *    محادثة قديمة اتقطعت بعد نداء أداة: أول رسالة محفوظة بتبقى رد
 *    موديل أو نتيجة أداة، وجوجل بترفض.
 *
 * الاتنين كانوا بيوصلوا للتاجر كـ«رد غير متوقّع (400)».
 */
function cleanHistory(messages: AgentMessage[]): Array<{ role: 'user' | 'model'; parts: Part[] }> {
  const mapped = messages
    .map((m) => ({
      // جوجل بتسمّي دور نتيجة الأداة «user» — مش «tool»
      role: (m.role === 'model' ? 'model' : 'user') as 'user' | 'model',
      parts: toParts(m),
    }))
    .filter((m) => m.parts.length > 0)

  const firstUser = mapped.findIndex((m) => m.role === 'user')
  return firstUser <= 0 ? mapped : mapped.slice(firstUser)
}

/**
 * دورة واحدة مع الوكيل.
 *
 * بترجّع كلام الموديل **و** الأدوات اللي طلبها — من غير ما تنفّذ
 * حاجة. التنفيذ قرار الطبقة اللي فوق، وده الحاجز اللي بيمنع الموديل
 * إنه يغيّر أسعار من غير ما التاجر يشوف.
 */
export async function agentTurn(input: {
  apiKey: string
  model: string
  system: string
  messages: AgentMessage[]
  tools: ToolDef[]
  maxTokens?: number
}): Promise<GeminiResult<AgentTurn>> {
  try {
    const res = await callWithRetry(
      `${BASE}/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: cleanHistory(input.messages),
          systemInstruction: { parts: [{ text: input.system }] },
          tools: input.tools.length
            ? [{ functionDeclarations: input.tools.map(cleanTool) }]
            : undefined,
          generationConfig: {
            maxOutputTokens: input.maxTokens ?? 1200,
            // الوكيل بينفّذ إجراءات — الدقة أهم من التنوّع
            temperature: 0.2,
          },
        }),
      },
    )

    if (!res.ok) return { ok: false, error: classify(res.status, await res.text()) }

    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Part[] } }>
      promptFeedback?: { blockReason?: string }
    }

    if (data.promptFeedback?.blockReason) {
      return { ok: false, error: { kind: 'blocked', message: 'الطلب اتمنع من فلاتر جوجل.' } }
    }

    const parts = data.candidates?.[0]?.content?.parts ?? []
    const text = parts
      .map((p) => ('text' in p ? p.text : ''))
      .join('')
      .trim()

    const calls: ToolCall[] = parts
      .filter((p): p is Extract<Part, { functionCall: unknown }> => 'functionCall' in p)
      .map((p) => ({
        name: p.functionCall.name,
        args: p.functionCall.args ?? {},
        thoughtSignature: p.thoughtSignature,
      }))

    if (!text && calls.length === 0) {
      return { ok: false, error: { kind: 'unknown', message: 'جوجل رجّعت رد فاضي.' } }
    }

    return { ok: true, data: { text, calls } }
  } catch (e) {
    return { ok: false, error: networkError(e) }
  }
}

/* ══════════════════ الصور ══════════════════ */

/**
 * موديلات الصور.
 *
 * جوجل بتعلّم موديلات الصور بإن اسمها فيه «image»، وبتدعم
 * `responseModalities` — بترجّع صورة مش نص. القايمة بتتجاب من
 * المفتاح نفسه زي موديلات النص بالظبط، فلو جوجل طلّعت واحدًا جديدًا
 * بيبان لوحده من غير ما نعدّل سطر.
 */
export function isImageModel(id: string): boolean {
  return /image/i.test(id) && !/embed/i.test(id)
}

/** موديلات الصور المتاحة للمفتاح ده */
export async function listImageModels(apiKey: string): Promise<GeminiResult<GeminiModel[]>> {
  try {
    const res = await callWithRetry(
      `${BASE}/models?key=${encodeURIComponent(apiKey)}&pageSize=200`,
      {},
    )

    if (!res.ok) return { ok: false, error: classify(res.status, await res.text()) }

    const data = (await res.json()) as {
      models?: Array<{ name: string; displayName?: string; supportedGenerationMethods?: string[] }>
    }

    const models = (data.models ?? [])
      .map((m) => {
        const id = m.name.replace(/^models\//, '')
        return {
          id,
          label: m.displayName ?? id,
          usable: (m.supportedGenerationMethods ?? []).includes('generateContent'),
        }
      })
      .filter((m) => m.usable && isImageModel(m.id))
      .sort((a, b) => rank(b.id) - rank(a.id) || b.id.localeCompare(a.id))

    return { ok: true, data: models }
  } catch (e) {
    return { ok: false, error: networkError(e) }
  }
}

export type GeneratedImage = { mimeType: string; dataBase64: string }

/**
 * تعديل صورة أو توليد واحدة.
 *
 * لو بعتّ صورة، الموديل بيعدّلها؛ لو ما بعتّش، بيولّد واحدة من
 * الوصف. الاتنين نفس النداء عند جوجل — الفرق إن الصورة بتتحطّ
 * كجزء `inlineData` جنب الوصف.
 *
 * **بيرجّع الصورة خام لا رابط.** الرفع للتخزين قرار الطبقة اللي
 * فوق: التاجر ممكن يجرّب خمس تعديلات ويختار واحدًا، ورفع الخمسة
 * كان هيملا التخزين بأربع صور محدش هيشوفها.
 */
export async function editImage(input: {
  apiKey: string
  model: string
  prompt: string
  /** الصورة الأصلية — سيبها فاضية عشان يولّد من الصفر */
  image?: InlineImage
}): Promise<GeminiResult<GeneratedImage>> {
  try {
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = []
    if (input.image) {
      parts.push({ inlineData: { mimeType: input.image.mimeType, data: input.image.dataBase64 } })
    }
    parts.push({ text: input.prompt })

    const res = await callWithRetry(
      `${BASE}/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          generationConfig: {
            /*
              لازم نطلب الصورة صراحةً.

              من غير `responseModalities` الموديل بيرد بنص بيوصف
              التعديل بدل ما يعمله — والتاجر بيقرا فقرة عن صورته
              وهو مستنّي صورة.
            */
            responseModalities: ['IMAGE'],
          },
        }),
      },
    )

    if (!res.ok) return { ok: false, error: classify(res.status, await res.text()) }

    const data = (await res.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> }
      }>
      promptFeedback?: { blockReason?: string }
    }

    if (data.promptFeedback?.blockReason) {
      return {
        ok: false,
        error: { kind: 'blocked', message: 'الطلب اتمنع من فلاتر جوجل. غيّر الوصف وجرّب تاني.' },
      }
    }

    const img = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData

    if (!img?.data) {
      return {
        ok: false,
        error: { kind: 'unknown', message: 'الموديل ما رجّعش صورة. جرّب موديل صور تاني.' },
      }
    }

    return {
      ok: true,
      data: { mimeType: img.mimeType ?? 'image/png', dataBase64: img.data },
    }
  } catch (e) {
    return { ok: false, error: networkError(e) }
  }
}
