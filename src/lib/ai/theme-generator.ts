import 'server-only'
import { extractJson, generate, type ClaudeMessage } from './claude'
import { briefLine, type StoreBrief } from './store-context'
import { THEME_FIELD_GUIDE, checkContrast, themePlanSchema, type ThemePlan } from './theme-schema'
import type { ContrastIssue } from './theme-schema'

/**
 * مولّد الثيمات.
 *
 * كلود بيرجّع **إعدادات** لا كودًا — المحرّك بتاعنا هو اللي بيرسم.
 * التاجر بياخد ثيمًا مفصّلًا على طلبه، ومحدش بيشغّل كود غريب في متجر
 * فيه فلوس عملاء.
 *
 * وبيرجّع **شرحًا** مع الإعدادات: التاجر يقرا ليه اللون ده وليه
 * التخطيط ده، فيقدر يقول «لأ، خلّي الخلفية أفتح» بدل ما يبص لنتيجة
 * مش فاهمها.
 */

export type ThemeResult =
  | { ok: true; plan: ThemePlan; contrast: ContrastIssue[]; reply: string }
  | { ok: false; error: string; needsSetup?: boolean }

function buildSystem(brief: StoreBrief): string {
  return [
    'إنت مصمّم واجهات بتظبّط شكل متجر إلكتروني عربي (اتجاه من اليمين للشمال).',
    '',
    `المتجر: ${brief.name}`,
    `عن المتجر: ${briefLine(brief)}`,
    brief.categories.length ? `أقسامه: ${brief.categories.slice(0, 10).join('، ')}` : '',
    '',
    '**إنت بتختار إعدادات لا بتكتب كود.** رجّع JSON بالشكل ده بالظبط:',
    '',
    THEME_FIELD_GUIDE,
    '',
    'قواعد ملزمة:',
    '- **رجّع الحقول اللي التاجر طلبها أو اللي لازمة لطلبه بس.** أي حقل',
    '  ما تحطّهوش بيفضل زي ما هو. ملء كل حاجة بيخلّيك تخترع اختيارات',
    '  التاجر ما طلبهاش وبيبوّظ ثيمه الحالي.',
    '- **التباين لازم يكون مقروء**: النص على الخلفية والنص على الكروت',
    '  لازم يكون بينهم فرق واضح. لون نص قريب من الخلفية بيخلّي المتجر',
    '  غير مقروء، والتاجر ما بيلاحظش غير لما عميل يشتكي.',
    '- الخلفية والكروت لازم يكونوا مختلفين — لو اتساووا الكروت بتختفي.',
    '- ما تخترعش قيم برّه الاختيارات المذكورة. أي قيمة تانية هتترفض.',
    '- الألوان بصيغة #RRGGBB بس، بحروف كبيرة أو صغيرة.',
    '- `rationale` جملة قصيرة بالعربي المصري بتقول ليه اخترت كده.',
    '',
    'رجّع JSON بس — من غير أي كلام قبله أو بعده.',
  ]
    .filter(Boolean)
    .join('\n')
}

/**
 * توليد ثيم من وصف التاجر.
 *
 * `history` بتخلّي التاجر يقول «خلّي الخلفية أفتح» من غير ما يعيد
 * وصف الثيم كله — وده اللي بيخلّي الحوار مفيدًا بدل ما يبقى طلبًا
 * منفصلًا كل مرة.
 */
export async function generateTheme(input: {
  apiKey: string
  model: string
  brief: StoreBrief
  history: ClaudeMessage[]
  request: string
}): Promise<ThemeResult> {
  const res = await generate({
    apiKey: input.apiKey,
    model: input.model,
    system: buildSystem(input.brief),
    messages: [...input.history, { role: 'user', text: input.request }],
    // التصميم محتاج تنوّعًا، بس مش لدرجة إنه يخرج عن الطلب
    temperature: 0.7,
    maxTokens: 2000,
    // بنبدأ الرد بالقوس — فمش هيقدر يبدأ بمقدمة تكسر التحليل
    prefill: '{',
  })

  if (!res.ok) {
    return {
      ok: false,
      error: res.error.message,
      needsSetup: res.error.kind === 'invalid_key' || res.error.kind === 'credit',
    }
  }

  const json = extractJson(res.data)
  if (!json) return { ok: false, error: 'الرد جه بشكل مش مفهوم. جرّب تاني.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'الرد مش JSON صحيح. جرّب تاني.' }
  }

  const checked = themePlanSchema.safeParse(parsed)
  if (!checked.success) {
    /*
      الرفض هنا مقصود ومهم: أي حقل برّه المخطط معناه إن كلود حاول
      يخرج عن الإعدادات. بنقول للتاجر السبب بدل ما نطبّق نص الخطة.
    */
    const first = checked.error.issues[0]
    return {
      ok: false,
      error: `الإعدادات اللي رجعت مش مقبولة (${first?.path.join('.') || 'حقل غير معروف'}). جرّب تصيغ طلبك بشكل تاني.`,
    }
  }

  const plan = checked.data

  return {
    ok: true,
    plan,
    contrast: checkContrast(plan.identity),
    reply: plan.rationale ?? `جهّزت «${plan.name}».`,
  }
}
