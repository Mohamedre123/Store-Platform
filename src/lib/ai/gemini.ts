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
  return { kind: 'unknown', message: `رد غير متوقّع من جوجل (${status}).` }
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
    const res = await fetch(`${BASE}/models?key=${encodeURIComponent(apiKey)}&pageSize=100`, {
      cache: 'no-store',
    })

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
    return { ok: false, error: { kind: 'network', message: String(e).slice(0, 200) } }
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
    const res = await fetch(
      `${BASE}/models/${encodeURIComponent(input.model)}:generateContent?key=${encodeURIComponent(input.apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
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
    return { ok: false, error: { kind: 'network', message: String(e).slice(0, 200) } }
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
