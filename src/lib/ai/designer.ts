import 'server-only'
import { extractJson, generate as claudeGenerate, type ClaudeMessage } from './claude'
import { generate as geminiGenerate } from './gemini'

/**
 * المصمّم — كلود أو جيميني، نفس الواجهة.
 *
 * توليد الثيمات وصفحات الهبوط كان مربوطًا بكلود وحده. الربط ده
 * بيخلّي التاجر مجبورًا يفتح حسابًا عند أنثروبيك ويشحنه، حتى لو
 * معاه مفتاح جيميني شغّال أصلًا للبوت.
 *
 * **الاتنين بيعرفوا يعملوها.** فالتاجر بيحطّ اللي معاه — أو الاتنين
 * ويختار الموديل اللي عايزه من القايمتين.
 *
 * الملف ده هو الحاجز: المولّدات بتنادي `designerGenerate` وما
 * بتعرفش مين ورا. لو ضفنا مزوّدًا تالتًا، بيتضاف هنا وبس.
 */

export type DesignerProvider = 'claude' | 'gemini'

export type DesignerResult =
  | { ok: true; data: string }
  | { ok: false; error: string; needsSetup: boolean }

export type DesignerInput = {
  provider: DesignerProvider
  apiKey: string
  model: string
  system: string
  messages: ClaudeMessage[]
  maxTokens?: number
  /**
   * بادئة الرد — لكلود بس.
   *
   * جيميني مالوش المفهوم ده، وبنعوّضه بتعليمة صريحة في النظام.
   * استخراج JSON من النص بيشتغل مع الاتنين على أي حال.
   */
  prefill?: string
}

export async function designerGenerate(input: DesignerInput): Promise<DesignerResult> {
  if (input.provider === 'claude') {
    const res = await claudeGenerate({
      apiKey: input.apiKey,
      model: input.model,
      system: input.system,
      messages: input.messages,
      maxTokens: input.maxTokens,
      prefill: input.prefill,
    })

    return res.ok
      ? { ok: true, data: res.data }
      : {
          ok: false,
          error: res.error.message,
          needsSetup: res.error.kind === 'invalid_key' || res.error.kind === 'credit',
        }
  }

  /*
    جيميني بياخد الأدوار بأسماء تانية (`model` بدل `assistant`)،
    والتعليمة الصريحة بتاخد مكان البادئة.
  */
  const res = await geminiGenerate({
    apiKey: input.apiKey,
    model: input.model,
    system: input.prefill
      ? `${input.system}\n\nمهم: رُدّ بكائن JSON صالح بس — من غير أي كلام قبله أو بعده، ومن غير علامات كود.`
      : input.system,
    messages: input.messages.map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      text: m.text,
    })),
    maxTokens: input.maxTokens,
  })

  return res.ok
    ? { ok: true, data: res.data }
    : {
        ok: false,
        error: res.error.message,
        needsSetup: res.error.kind === 'invalid_key' || res.error.kind === 'quota',
      }
}

export { extractJson }
