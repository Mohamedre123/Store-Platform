import 'server-only'

/**
 * عميل Claude.
 *
 * بالـREST مباشرة زي Gemini وResend — من غير حزمة.
 *
 * **بمفتاح التاجر.** كلود بيتستخدم في توليد الثيمات وصفحات الهبوط،
 * وده أغلى من التحسين العادي لأن الرد أطول وأعقد. التاجر بيدفع
 * استهلاكه هو.
 */

const BASE = 'https://api.anthropic.com/v1'
const VERSION = '2023-06-01'

export type ClaudeError =
  | { kind: 'invalid_key'; message: string }
  | { kind: 'credit'; message: string }
  | { kind: 'rate_limit'; message: string }
  | { kind: 'overloaded'; message: string }
  | { kind: 'network'; message: string }
  | { kind: 'unknown'; message: string }

export type ClaudeResult<T> = { ok: true; data: T } | { ok: false; error: ClaudeError }

/**
 * ترجمة خطأ المزوّد.
 *
 * «رصيدك خلص» و«المفتاح باطل» بيقولوا للتاجر يعمل إيه. «فشل الاتصال»
 * بيسيبه يخمّن — والتخمين بيخلّيه يجرّب نفس الحاجة عشر مرات.
 */
function classify(status: number, body: string): ClaudeError {
  const lower = body.toLowerCase()

  if (status === 401) {
    return { kind: 'invalid_key', message: 'المفتاح باطل. راجعه من console.anthropic.com.' }
  }
  if (status === 403) {
    return { kind: 'invalid_key', message: 'المفتاح مرفوض — يمكن مقفول أو صلاحياته ناقصة.' }
  }
  if (status === 400 && lower.includes('credit')) {
    return {
      kind: 'credit',
      message: 'رصيد حسابك خلص. اشحنه من console.anthropic.com ← Billing.',
    }
  }
  if (status === 429) {
    return {
      kind: 'rate_limit',
      message: 'وصلت لحد الاستخدام دلوقتي. استنى دقيقة وجرّب تاني.',
    }
  }
  if (status === 529 || lower.includes('overloaded')) {
    return { kind: 'overloaded', message: 'الخدمة مزحومة دلوقتي. جرّب بعد شوية.' }
  }
  if (status >= 500) {
    return { kind: 'network', message: 'خدمة Claude مش مستجيبة. جرّب بعد شوية.' }
  }
  return { kind: 'unknown', message: `رد غير متوقّع (${status}).` }
}

export type ClaudeModel = { id: string; label: string }

/**
 * الموديلات المتاحة **للمفتاح ده** — من عند Anthropic لا من قايمة عندنا.
 *
 * نفس سبب Gemini: أي قايمة نكتبها بتبقى قديمة، والتاجر يلاقي موديل
 * مذكور ومش شغّال. والمزوّد بيرجّع الأحدث الأول أصلًا.
 */
export async function listModels(apiKey: string): Promise<ClaudeResult<ClaudeModel[]>> {
  try {
    const res = await fetch(`${BASE}/models?limit=50`, {
      headers: { 'x-api-key': apiKey, 'anthropic-version': VERSION },
      cache: 'no-store',
    })

    if (!res.ok) return { ok: false, error: classify(res.status, await res.text()) }

    const data = (await res.json()) as {
      data?: Array<{ id: string; display_name?: string }>
    }

    const models = (data.data ?? []).map((m) => ({
      id: m.id,
      label: m.display_name ?? m.id,
    }))

    return { ok: true, data: models }
  } catch (e) {
    return { ok: false, error: { kind: 'network', message: String(e).slice(0, 200) } }
  }
}

/**
 * الموديل الافتراضي: الأحدث اللي المزوّد بيرجّعه.
 *
 * القايمة راجعة مرتّبة من الأحدث، فأول واحد هو المطلوب. من غير أي
 * أسماء مكتوبة عندنا تبقى قديمة بعد إصدار.
 */
export function pickDefaultModel(models: ClaudeModel[]): string | null {
  return models[0]?.id ?? null
}

export type ClaudeMessage = { role: 'user' | 'assistant'; text: string }

/**
 * نداء توليد.
 *
 * `system` منفصل عن الرسايل: كده الموديل بيفرّق بين تعليماتنا وكلام
 * التاجر، وأصعب إن نص جاي من برّه يقنعه يتجاهلها.
 */
export async function generate(input: {
  apiKey: string
  model: string
  system: string
  messages: ClaudeMessage[]
  maxTokens?: number
  temperature?: number
  /**
   * بادئة لرد الموديل.
   *
   * لما نطلب JSON، بنبدأ الرد بـ`{` بنفسنا — كده بيكمّل من عندها
   * ومش بيقدر يبدأ بمقدمة زي «تمام، دي الإعدادات:». المقدمة دي
   * بتكسر التحليل، والتنظيف بعدها بيبقى تخمين.
   */
  prefill?: string
}): Promise<ClaudeResult<string>> {
  try {
    const messages = input.messages.map((m) => ({ role: m.role, content: m.text }))
    if (input.prefill) messages.push({ role: 'assistant', content: input.prefill })

    /**
     * `temperature` بيتبعت بس لو اتطلب صراحةً.
     *
     * الموديلات الجديدة (Opus 4.8 وما بعده) **بترفض الطلب كله** لو
     * الحقل موجود:
     *
     *     400 · `temperature` is deprecated for this model.
     *
     * ودي كانت بتوقّف توليد الثيمات وصفحات الهبوط تمامًا، لأننا
     * كنا بنبعته دايمًا بقيمة افتراضية. القيمة الافتراضية بتاعة
     * المزوّد كويسة، ومفيش سبب نفرض واحدة.
     */
    const payload: Record<string, unknown> = {
      model: input.model,
      max_tokens: input.maxTokens ?? 4000,
      system: input.system,
      messages,
    }
    if (input.temperature !== undefined) payload.temperature = input.temperature

    const call = (body: Record<string, unknown>) =>
      fetch(`${BASE}/messages`, {
        method: 'POST',
        headers: {
          'x-api-key': input.apiKey,
          'anthropic-version': VERSION,
          'content-type': 'application/json',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(120_000),
        body: JSON.stringify(body),
      })

    let res = await call(payload)

    /*
      المحاولة التانية من غير `temperature`.

      شبكة أمان للموديلات اللي بترفضه: بدل ما التاجر يشوف خطأ ٤٠٠
      غامض ويقف، بنشيل الحقل ونعيد — ونفس النتيجة بتطلع.
    */
    if (res.status === 400 && payload.temperature !== undefined) {
      const body = await res.clone().text()
      if (body.toLowerCase().includes('temperature')) {
        delete payload.temperature
        res = await call(payload)
      }
    }

    /**
     * المحاولة التالتة من غير بادئة الرد.
     *
     * الموديلات الجديدة بترفض إن المحادثة تنتهي برسالة مساعد:
     *
     *     400 · This model does not support assistant message prefill.
     *
     * البادئة كانت حيلة عشان الرد يبدأ بـ`{` على طول، بس هي مش
     * ضرورية — استخراج أول كائن JSON من النص بيوصل لنفس النتيجة،
     * وشغّال مع كل الموديلات القديمة والجديدة.
     */
    let usedPrefill = Boolean(input.prefill)

    if (res.status === 400 && usedPrefill) {
      const body = await res.clone().text()
      if (body.toLowerCase().includes('prefill')) {
        payload.messages = input.messages.map((m) => ({ role: m.role, content: m.text }))
        usedPrefill = false
        res = await call(payload)
      }
    }

    if (!res.ok) return { ok: false, error: classify(res.status, await res.text()) }

    const data = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>
      stop_reason?: string
    }

    const text = (data.content ?? [])
      .filter((c) => c.type === 'text')
      .map((c) => c.text ?? '')
      .join('')

    if (!text.trim()) {
      return { ok: false, error: { kind: 'unknown', message: 'الرد جه فاضي.' } }
    }

    /*
      البادئة مش بترجع في الرد — بنلزقها قدامه عشان النص يبقى كاملًا.
      من غير كده الـJSON بيبدأ من غير القوس الأول ومش بيتحلّل.
    */
    return { ok: true, data: usedPrefill ? (input.prefill ?? '') + text : text }
  } catch (e) {
    return { ok: false, error: { kind: 'network', message: String(e).slice(0, 200) } }
  }
}

/**
 * التحقق من المفتاح.
 *
 * بنداء حقيقي زي Gemini. مفاتيح Anthropic بتبدأ بـ`sk-ant-` غالبًا،
 * لكن الاعتماد على الشكل بيرفض أي صيغة جديدة — والتاجر يفضل يحاول
 * ومش فاهم هو غلطان فين.
 */
export async function verifyKey(
  apiKey: string,
): Promise<ClaudeResult<{ models: ClaudeModel[]; suggested: string }>> {
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

/**
 * استخراج JSON من رد الموديل.
 *
 * حتى مع البادئة، الموديل ممكن يلفّ الرد في ```json أو يضيف كلامًا
 * بعده. بناخد أول كائن متوازن الأقواس بدل ما نثق في الشكل.
 */
export function extractJson(raw: string): string | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const body = fenced ? fenced[1] : raw

  const start = body.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < body.length; i++) {
    const ch = body[i]

    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return body.slice(start, i + 1)
    }
  }

  return null
}
