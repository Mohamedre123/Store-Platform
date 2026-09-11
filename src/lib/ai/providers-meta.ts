/**
 * مزوّدو الذكاء — **للجهتين**.
 *
 * ملف مستقل عن `settings.ts` و`llm.ts` لأن الاتنين `server-only`،
 * وكروت الإضافات ولوحة المساعد مكوّنات عميل ومحتاجة نفس الأسماء
 * والروابط. لو كل جهة كتبت قايمتها، الكارت يقول «ChatGPT» والخادم
 * يدوّر على مزوّد اسمه غير كده.
 */

export type AiProvider = 'gemini' | 'openai'

export const AI_PROVIDERS: Array<{
  key: AiProvider
  /** الاسم اللي التاجر يعرفه — «ChatGPT» مش «OpenAI» */
  label: string
  keyLabel: string
  keyPlaceholder: string
  /** صفحة إنشاء المفتاح عند المزوّد */
  keyHref: string
}> = [
  {
    key: 'gemini',
    label: 'Gemini',
    keyLabel: 'مفتاح Gemini (Google)',
    keyPlaceholder: 'مفتاحك من Google AI Studio',
    keyHref: 'https://aistudio.google.com/apikey',
  },
  {
    key: 'openai',
    label: 'ChatGPT',
    keyLabel: 'مفتاح ChatGPT (OpenAI)',
    keyPlaceholder: 'sk-…',
    keyHref: 'https://platform.openai.com/api-keys',
  },
]

export function isProvider(v: unknown): v is AiProvider {
  return v === 'gemini' || v === 'openai'
}

export function providerLabel(key: string): string {
  return AI_PROVIDERS.find((p) => p.key === key)?.label ?? (key === 'claude' ? 'Claude' : key)
}

/**
 * رسالة «مفيش رصيد» لكل مزوّد — بنفس الصياغة في كل مكان.
 *
 * ## ليه رسالة واحدة مكتوبة هنا
 * البوت والمساعد والاستوديو والمصمّم كانوا بيقولوا نفس المشكلة بأربع
 * جمل، وبعضهم كان بيقول «رد غير متوقّع (429)». التاجر اللي خلص رصيده
 * لازم يقرا نفس الجملة في أي مكان وقف فيه، وفيها **مكان الشحن بالظبط**.
 *
 * ## واشتراك ChatGPT مش رصيد API
 * أشهر لخبطة: التاجر مشترك ChatGPT Plus فبيفتكر المفتاح هيشتغل. الـAPI
 * حساب منفصل برصيد مسبق، والجملة بتقول ده صراحةً.
 */
export const CREDIT_HELP: Record<AiProvider | 'claude', string> = {
  openai:
    'حساب ChatGPT (OpenAI) ده مالوش رصيد، فمش هيرد. اشحن رصيد من platform.openai.com ← Settings ← Billing. ' +
    'واشتراك ChatGPT Plus منفصل عن الـAPI ومش بيشغّل المفتاح.',
  gemini:
    'مفتاح Gemini وصل لحدّه — يا إما الحصّة المجانية خلصت (فعّل الفوترة من aistudio.google.com ← Billing) ' +
    'يا إما ضغط لحظي (استنى دقيقة وجرّب).',
  claude: 'حساب Claude (Anthropic) مالوش رصيد. اشحن من console.anthropic.com ← Settings ← Billing.',
}

/** آخر مشكلة حساب اتسجّلت على الإضافة — بتتعرض في كارتها */
export type AiIssue = { provider: string; message: string; at: string }
