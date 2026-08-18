/**
 * خطط الاشتراك.
 *
 * الأسعار بالقرش زي كل مبالغ المنصة. الاشتراك الفعلي محتاج بوابة دفع
 * متعاقد عليها — لحد ما تتربط، الترقية بتتم بالتواصل، والحالة الحقيقية
 * بتتقرا من قاعدة البيانات مش من مكان تاني.
 */

export type PlanKey = 'starter' | 'growth' | 'pro'

export type Plan = {
  key: PlanKey
  name: string
  priceMonthly: number
  tagline: string
  features: string[]
  highlight?: boolean
}

export const PLANS: Plan[] = [
  {
    key: 'starter',
    name: 'البداية',
    priceMonthly: 29900,
    tagline: 'لأول متجر — كل الأساسيات عشان تبيع.',
    features: [
      'منتجات وأقسام بلا حدود',
      'الدفع عند الاستلام والتحويل',
      'الشحن لكل المحافظات',
      'الطلبات الناقصة وتتبّعها',
      'ثيمات جاهزة ومحرّر كامل',
      'نطاق فرعي مجاني',
    ],
  },
  {
    key: 'growth',
    name: 'النمو',
    priceMonthly: 59900,
    tagline: 'لما تبدأ تعلن وتحتاج تقيس.',
    highlight: true,
    features: [
      'كل مميزات البداية',
      'نطاقك الخاص',
      'بكسلات الإعلانات كلها',
      'الكوبونات والعروض',
      'تحليلات مفصّلة وربح تقديري',
      'تذكير السلات المتروكة',
    ],
  },
  {
    key: 'pro',
    name: 'المحترف',
    priceMonthly: 119900,
    tagline: 'لمتاجر بحجم أكبر وفريق.',
    features: [
      'كل مميزات النمو',
      'بوابات دفع إلكتروني',
      'ربط شركات الشحن',
      'مستخدمين وصلاحيات',
      'برنامج الولاء والنقاط',
      'دعم أولوية',
    ],
  },
]

export const STATUS_LABEL: Record<string, string> = {
  trial: 'فترة تجريبية',
  active: 'اشتراك نشط',
  past_due: 'متأخر السداد',
  suspended: 'موقوف',
}

/** كام يوم فاضل — رقم سالب معناه انتهت */
export function daysLeft(date: Date | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
}
