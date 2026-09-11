import 'server-only'
import { extractJson, generate as claudeGenerate, type ClaudeMessage } from './claude'
import { generate as geminiGenerate } from './gemini'
import { generate as openaiGenerate } from './openai'
import { recordAiIssue, CLAUDE_SLUG } from './settings'

/**
 * المصمّم — كلود أو جيميني أو ChatGPT، نفس الواجهة.
 *
 * توليد الثيمات وصفحات الهبوط كان مربوطًا بكلود وحده. الربط ده
 * بيخلّي التاجر مجبورًا يفتح حسابًا عند أنثروبيك ويشحنه، حتى لو
 * معاه مفتاح شغّال أصلًا للبوت.
 *
 * **التلاتة بيعرفوا يعملوها.** فالتاجر بيحطّ اللي معاه — أو أكتر من
 * واحد ويختار الموديل اللي عايزه.
 *
 * الملف ده هو الحاجز: المولّدات بتنادي `designerGenerate` وما
 * بتعرفش مين ورا. لو ضفنا مزوّدًا تانيًا، بيتضاف هنا وبس.
 */

export type DesignerProvider = 'claude' | 'gemini' | 'openai'

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
   * جيميني وChatGPT مالهمش المفهوم ده، وبنعوّضه بتعليمة صريحة (وفي
   * ChatGPT بإعداد JSON). استخراج JSON من النص بيشتغل مع التلاتة.
   */
  prefill?: string
  /** عشان «مالوش رصيد» تتسجّل على كارت الإضافة */
  storeId?: string
}

const JSON_ONLY =
  'مهم: رُدّ بكائن JSON صالح بس — من غير أي كلام قبله أو بعده، ومن غير علامات كود.'

export async function designerGenerate(input: DesignerInput): Promise<DesignerResult> {
  const result = await run(input)

  if (!result.ok && result.needsSetup && input.storeId) {
    await recordAiIssue(input.storeId, CLAUDE_SLUG, input.provider, result.error)
  }

  return result
}

async function run(input: DesignerInput): Promise<DesignerResult> {
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

  if (input.provider === 'openai') {
    const res = await openaiGenerate({
      apiKey: input.apiKey,
      model: input.model,
      system: input.prefill ? `${input.system}\n\n${JSON_ONLY}` : input.system,
      messages: input.messages.map((m) => ({
        role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
        text: m.text,
      })),
      maxTokens: input.maxTokens ?? 8000,
      json: Boolean(input.prefill),
      /* الثيم الكامل رد طويل — مهلة الكلام العادي بتقطعه */
      timeoutMs: 150_000,
    })

    return res.ok
      ? { ok: true, data: res.data }
      : {
          ok: false,
          error: res.error.message,
          needsSetup:
            res.error.kind === 'invalid_key' || res.error.kind === 'no_credit' || res.error.kind === 'quota',
        }
  }

  /*
    جيميني بياخد الأدوار بأسماء تانية (`model` بدل `assistant`)،
    والتعليمة الصريحة بتاخد مكان البادئة.
  */
  const res = await geminiGenerate({
    apiKey: input.apiKey,
    model: input.model,
    system: input.prefill ? `${input.system}\n\n${JSON_ONLY}` : input.system,
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
