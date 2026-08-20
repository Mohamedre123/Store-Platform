/**
 * حسابات نتيجة التجربة وثوابتها.
 *
 * منفصلة عن `experiments.ts` (اللي بيلمس قاعدة البيانات فهو
 * server-only) عشان لوحة التاجر مكوّن متصفح ومحتاجة نفس الحساب.
 * لو استوردت منه، الصفحة بتقع وقت التشغيل — وفحص الأنواع مش بيمسك
 * النوع ده من الأخطاء.
 */

export type ExperimentField = 'price' | 'image' | 'title' | 'description' | 'cta'

export const FIELD_LABELS: Record<ExperimentField, string> = {
  price: 'السعر',
  image: 'الصورة الأساسية',
  title: 'اسم المنتج',
  description: 'الوصف المختصر',
  cta: 'نص زرار الشراء',
}

/**
 * المجموعة اللي الزائر يقع فيها.
 *
 * دالة تجزئة بسيطة على معرّف الزائر: نفس المعرّف بيدّي نفس النتيجة
 * دايمًا، من غير ما نخزّن حاجة ولا نسأل قاعدة البيانات. العشوائية
 * الحقيقية كانت هتغيّر السعر على العميل وهو بيتفرّج.
 */
export function assignBucket(visitorId: string, splitBps: number): 'a' | 'b' {
  let hash = 0
  for (let i = 0; i < visitorId.length; i++) {
    hash = (hash * 31 + visitorId.charCodeAt(i)) >>> 0
  }
  return hash % 10000 < splitBps ? 'a' : 'b'
}

/**
 * أقل عدد مشاهدات قبل ما نعلن فايزًا.
 * قبل كده الفرق ضجيج، والتاجر اللي بيغيّر سعره على تجربة من ٥
 * زوّار بيخسر بثقة.
 */
export const MIN_VIEWS = 30

/**
 * قراءة النتيجة.
 *
 * الحكم على **الإيراد لكل مشاهدة** لا على معدّل التحويل: سعر أعلى
 * بيبيع أقل وبيكسب أكتر، وسعر أقل بيبيع أكتر وبيكسب أقل. اللي بيهمّ
 * التاجر هو الفلوس مش عدد القطع.
 */
export function readResult(exp: {
  viewsA: number
  viewsB: number
  ordersA: number
  ordersB: number
  revenueA: number
  revenueB: number
}) {
  const rpvA = exp.viewsA > 0 ? exp.revenueA / exp.viewsA : 0
  const rpvB = exp.viewsB > 0 ? exp.revenueB / exp.viewsB : 0
  const crA = exp.viewsA > 0 ? (exp.ordersA / exp.viewsA) * 100 : 0
  const crB = exp.viewsB > 0 ? (exp.ordersB / exp.viewsB) * 100 : 0

  const enough = exp.viewsA >= MIN_VIEWS && exp.viewsB >= MIN_VIEWS
  const winner: 'a' | 'b' | null = !enough ? null : rpvA === rpvB ? null : rpvA > rpvB ? 'a' : 'b'

  const better = Math.max(rpvA, rpvB)
  const worse = Math.min(rpvA, rpvB)
  const lift = worse > 0 ? Math.round(((better - worse) / worse) * 100) : null

  return { rpvA, rpvB, crA, crB, enough, winner, lift }
}
