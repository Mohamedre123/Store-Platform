import 'server-only'
import * as gemini from './gemini'
import * as openai from './openai'
import { CREDIT_HELP, type AiProvider } from './providers-meta'
import { noteAiOutcome, type Engine } from './settings'

/**
 * طبقة الذكاء الموحّدة — Gemini أو ChatGPT من نفس الباب.
 *
 * ## ليه طبقة
 * الذكاء متوصّل في ٧ أماكن: البوت، والمساعد، وزرار التحسين، و«حدّد
 * واسأل»، واستوديو الصور، والنشر التلقائي، والمصمّم. لو كل مكان سأل
 * «Gemini ولا OpenAI» بنفسه، أول مكان يتنسي بيفضل Gemini بس — والتاجر
 * اللي معاه مفتاح ChatGPT بيلاقي أداة واقفة من غير سبب.
 *
 * الأماكن بتنادي هنا بـ`Engine` وما بتعرفش مين ورا. ولو ضفنا مزوّدًا
 * تالتًا، بيتضاف هنا وبس.
 *
 * ## ونتيجة كل نداء بتتسجّل على الإضافة
 * «مالوش رصيد» بتتكتب على كارت الإضافة اللي المفتاح جاي منها — فالتاجر
 * بيشوفها حتى لو اللي وقف كان البوت قدام عميل وهو مش فاتح اللوحة.
 */

export type AiError = {
  kind: 'invalid_key' | 'quota' | 'no_credit' | 'blocked' | 'network' | 'unknown'
  message: string
}
export type AiResult<T> = { ok: true; data: T } | { ok: false; error: AiError }

/** مشكلة في الحساب — مفتاح أو رصيد — مش في الطلب نفسه */
export function isAccountProblem(e: AiError): boolean {
  return e.kind === 'invalid_key' || e.kind === 'quota' || e.kind === 'no_credit'
}

export async function generateText(
  engine: Engine,
  input: {
    system?: string
    messages: gemini.ChatMessage[]
    maxTokens?: number
    temperature?: number
    /** رد JSON — OpenAI بتلتزم بيه بإعداد، وGemini بتعليمة */
    json?: boolean
  },
): Promise<AiResult<string>> {
  const res: AiResult<string> =
    engine.provider === 'openai'
      ? await openai.generate({ apiKey: engine.apiKey, model: engine.model, ...input })
      : await gemini.generate({
          apiKey: engine.apiKey,
          model: engine.model,
          system: input.json
            ? `${input.system ?? ''}\n\nمهم: رُدّ بكائن JSON صالح بس — من غير أي كلام قبله أو بعده، ومن غير علامات كود.`
            : input.system,
          messages: input.messages,
          maxTokens: input.maxTokens,
          temperature: input.temperature,
        })

  await noteAiOutcome(engine, res)
  return res
}

export async function agentStep(
  engine: Engine,
  input: {
    system: string
    messages: gemini.AgentMessage[]
    tools: gemini.ToolDef[]
    maxTokens?: number
  },
): Promise<AiResult<gemini.AgentTurn>> {
  const res: AiResult<gemini.AgentTurn> =
    engine.provider === 'openai'
      ? await openai.agentTurn({ apiKey: engine.apiKey, model: engine.model, ...input })
      : await gemini.agentTurn({ apiKey: engine.apiKey, model: engine.model, ...input })

  await noteAiOutcome(engine, res)
  return res
}

export type AiModel = { id: string; label: string }

/** موديلات الكلام للمفتاح ده — من عند المزوّد نفسه */
export async function listTextModels(provider: AiProvider, apiKey: string): Promise<AiResult<AiModel[]>> {
  if (provider === 'openai') {
    const res = await openai.listModels(apiKey)
    return res.ok ? { ok: true, data: res.data.chat } : res
  }
  const res = await gemini.listModels(apiKey)
  return res.ok ? { ok: true, data: res.data.map((m) => ({ id: m.id, label: m.label })) } : res
}

/** موديلات الصور للمفتاح ده */
export async function listImageModels(provider: AiProvider, apiKey: string): Promise<AiResult<AiModel[]>> {
  if (provider === 'openai') {
    const res = await openai.listModels(apiKey)
    return res.ok ? { ok: true, data: res.data.image } : res
  }
  const res = await gemini.listImageModels(apiKey)
  return res.ok
    ? { ok: true, data: res.data.filter((m) => m.usable).map((m) => ({ id: m.id, label: m.label })) }
    : res
}

/**
 * التحقق من المفتاح — ومن إنه بيرد فعلًا.
 *
 * الموديلات بتتجاب من غير رصيد، فالمفتاح الصحيح اللي حسابه صفر كان
 * بيعدّي التحقّق وبيقف قدام أول عميل. النداء الصغير بعد القايمة بيطلّع
 * «مالوش رصيد» كتحذير **وقت الحفظ** — والمفتاح بيتحفظ عادي عشان التاجر
 * يشحن ويكمّل من غير ما يلصقه تاني.
 */
export async function verifyProviderKey(
  provider: AiProvider,
  apiKey: string,
): Promise<AiResult<{ models: AiModel[]; suggested: string; warning?: string }>> {
  if (provider === 'openai') return openai.verifyKey(apiKey)

  const res = await gemini.verifyKey(apiKey)
  if (!res.ok) return res

  const probe = await gemini.generate({
    apiKey,
    model: res.data.suggested,
    messages: [{ role: 'user', text: 'رد بكلمة واحدة: تمام' }],
    maxTokens: 64,
  })

  return {
    ok: true,
    data: {
      models: res.data.models.map((m) => ({ id: m.id, label: m.label })),
      suggested: res.data.suggested,
      warning:
        !probe.ok && (probe.error.kind === 'quota' || probe.error.kind === 'invalid_key')
          ? probe.error.message
          : undefined,
    },
  }
}

export { CREDIT_HELP }
