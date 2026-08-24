import 'server-only'
import type { ClaudeMessage } from './claude'
import { designerGenerate, extractJson, type DesignerProvider } from './designer'
import { briefLine, type StoreBrief } from './store-context'
import {
  LANDING_FIELD_GUIDE,
  landingPlanSchema,
  type LandingPlan,
} from './landing-schema'
import { checkContrast, type ContrastIssue } from './theme-schema'
import { BLOCK_LIBRARY, type Block } from '@/lib/landing'

/**
 * مولّد صفحات الهبوط.
 *
 * كلود بيختار بلوكات من مكتبتنا ويملا نصوصها — نفس حاجز الثيمات.
 *
 * والفرق المهم عن الثيم: الصفحة دي **حملة إعلانية**، فهويتها مستقلة
 * عن المتجر عن قصد. لكن لو التاجر قال «بهوية متجري»، بنبعتله ألوان
 * المتجر عشان يمشي عليها.
 */

export type ProductContext = {
  id: string
  name: string
  description: string | null
  price: string
  compareAt: string | null
  category: string | null
  brand: string | null
  images: number
}

export type LandingResult =
  | { ok: true; plan: LandingPlan; blocks: Block[]; contrast: ContrastIssue[]; reply: string }
  | { ok: false; error: string; needsSetup?: boolean }

function buildSystem(input: {
  brief: StoreBrief
  product: ProductContext | null
  storeColors: { primary: string; background: string; surface: string; text: string } | null
}): string {
  const lines = [
    'إنت كاتب صفحات هبوط (Landing Pages) للحملات الإعلانية في السوق المصري.',
    '',
    `المتجر: ${input.brief.name}`,
    `عن المتجر: ${briefLine(input.brief)}`,
  ]

  if (input.product) {
    lines.push(
      '',
      'المنتج اللي الصفحة عنه:',
      `- الاسم: ${input.product.name}`,
      `- السعر: ${input.product.price}`,
      input.product.compareAt ? `- السعر قبل الخصم: ${input.product.compareAt}` : '',
      input.product.category ? `- القسم: ${input.product.category}` : '',
      input.product.brand ? `- الماركة: ${input.product.brand}` : '',
      input.product.description ? `- الوصف: ${input.product.description.slice(0, 600)}` : '',
      `- عدد صوره: ${input.product.images}`,
    )
  }

  if (input.storeColors) {
    lines.push(
      '',
      'ألوان المتجر (لو التاجر طلب «بهوية متجري» استخدمها):',
      `- الأساسي ${input.storeColors.primary} · الخلفية ${input.storeColors.background} · الكروت ${input.storeColors.surface} · النص ${input.storeColors.text}`,
    )
  }

  lines.push(
    '',
    '**إنت بتختار بلوكات وبتكتب نصوصها — مش بتكتب كود.** رجّع JSON:',
    '',
    LANDING_FIELD_GUIDE,
    '',
    'قواعد ملزمة:',
    '- **ما تخترعش مواصفات ولا وعود.** مقاسات، خامات، مدد ضمان، نسب خصم —',
    '  كل ده لو مش في بيانات المنتج، ما تكتبهوش. صفحة بتوعد بحاجة المتجر',
    '  ما بيقدّمهاش بتجيب مرتجعات وشكاوى.',
    '- **آراء العملاء لازم تبان عامة** لأنها مش حقيقية: اكتبها بأسماء',
    '  أولى بس وكلام عن التجربة من غير تفاصيل مخترعة. والتاجر لازم',
    '  يستبدلها بآراء حقيقية — قوله كده في rationale.',
    '- ترتيب البلوكات يخدم البيع: واجهة تجذب، بعدين سبب، بعدين المنتج',
    '  والسعر، بعدين دليل، بعدين اعتراضات، وآخر حاجة دعوة.',
    '- **حط بلوك «product» مرة واحدة على الأقل** لو فيه منتج مربوط —',
    '  ده اللي فيه زرار الشراء الحقيقي والسعر الصح من قاعدة البيانات.',
    '- التباين لازم يكون مقروء: النص على الخلفية والنص على الأقسام.',
    '- ما تحطش روابط صور. الصور بتتاخد من المنتج أو التاجر بيرفعها.',
    '- اكتب بالعربي المصري اللي العميل بيتكلمه.',
    '',
    'رجّع JSON بس — من غير أي كلام قبله أو بعده.',
  )

  return lines.filter(Boolean).join('\n')
}

/**
 * تحويل خطة كلود لبلوكات حقيقية.
 *
 * الإعدادات الافتراضية بتتحط الأول والقيم اللي كلود كتبها فوقها:
 * أي حقل ما ذكرهوش (صور، أعمدة، أعلام) بياخد قيمة سليمة بدل ما
 * يبقى فاضي ويكسر العرض.
 */
function toBlocks(plan: LandingPlan): Block[] {
  return plan.blocks.map((b, i) => {
    const def = BLOCK_LIBRARY.find((d) => d.type === b.type)
    const { type, ...settings } = b

    return {
      id: `ai${Date.now()}${i}`,
      type,
      settings: { ...(def?.defaults ?? {}), ...settings },
    }
  })
}

export async function generateLanding(input: {
  apiKey: string
  model: string
  /** كلود ولا جيميني — الاتنين بيعرفوا يعملوها */
  provider: DesignerProvider
  brief: StoreBrief
  product: ProductContext | null
  storeColors: { primary: string; background: string; surface: string; text: string } | null
  history: ClaudeMessage[]
  request: string
}): Promise<LandingResult> {
  const res = await designerGenerate({
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
    system: buildSystem(input),
    messages: [...input.history, { role: 'user', text: input.request }],
    // صفحة كاملة ببلوكاتها أطول بكتير من خطة ثيم
    maxTokens: 6000,
    prefill: '{',
  })

  if (!res.ok) {
    return { ok: false, error: res.error, needsSetup: res.needsSetup }
  }

  const json = extractJson(res.data)
  if (!json) return { ok: false, error: 'الرد جه بشكل مش مفهوم. جرّب تاني.' }

  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'الرد مش JSON صحيح. جرّب تاني.' }
  }

  const checked = landingPlanSchema.safeParse(parsed)
  if (!checked.success) {
    const first = checked.error.issues[0]
    return {
      ok: false,
      error: `الصفحة اللي رجعت مش مقبولة (${first?.path.join('.') || 'حقل غير معروف'}). جرّب تصيغ طلبك بشكل تاني.`,
    }
  }

  const plan = checked.data

  return {
    ok: true,
    plan,
    blocks: toBlocks(plan),
    contrast: checkContrast(plan.tokens),
    reply: plan.rationale ?? `جهّزت «${plan.name}» بـ${plan.blocks.length} قسم.`,
  }
}
