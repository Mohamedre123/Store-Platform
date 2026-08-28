import type { PlanKey } from '@/db/schema'
import { config } from './config'

/**
 * باقات المنصة.
 *
 * الأسعار بالقرش زي كل مبالغ المنصة (50000 = 500 ج.م). المكان الوحيد
 * اللي الأرقام دي بتتكتب فيه — صفحة الاشتراك ولوحة الإدارة وسجل الطلبات
 * كلهم بيقروا من هنا، فتغيير السعر تعديل سطر واحد.
 *
 * **الدفع برّه المنصة**: محفظة أو إنستا باي (`src/lib/billing.ts`)،
 * والتفعيل بإيد الإدارة. الباقة هنا بتقول «كام وكام يوم» بس.
 */

export type Plan = {
  key: PlanKey
  name: string
  /** بالقرش */
  price: number
  /** طول الفترة بالأيام — الأساس اللي بيتحسب عليه تاريخ الانتهاء */
  days: number
  interval: 'trial' | 'month' | 'year'
  tagline: string
  features: string[]
  highlight?: boolean
}

/** المميزات اللي بتتفتح بأي اشتراك — واحدة في كل الباقات عن قصد */
const FULL_FEATURES = [
  'أدوات الذكاء الاصطناعي كلها',
  'صفحات الهبوط بلا حدود',
  'طلبات بلا حدود',
  'ربط نطاقك الخاص',
  'كل مميزات المتجر والشحن والدفع',
]

export const PLANS: Plan[] = [
  {
    key: 'trial',
    name: 'تجربة مجانية',
    price: 0,
    /* المدة من config عشان ما يبقاش فيه رقمين للحاجة الواحدة */
    days: config.trialDays,
    interval: 'trial',
    tagline: `${config.trialDays} أيام بكل المميزات — من غير أي دفع.`,
    features: [...FULL_FEATURES, `بتتوقف لوحدها بعد ${config.trialDays} أيام`],
  },
  {
    key: 'monthly',
    name: 'الباقة الشهرية',
    price: 50_000,
    days: 30,
    interval: 'month',
    highlight: true,
    tagline: 'شهر كامل، كل حاجة مفتوحة.',
    features: FULL_FEATURES,
  },
  {
    key: 'yearly',
    name: 'الباقة السنوية',
    price: 550_000,
    days: 365,
    interval: 'year',
    tagline: 'سنة كاملة — بتوفّر تمن شهرين.',
    features: [...FULL_FEATURES, 'أوفر من الشهري بـ١٤٥٠ جنيه'],
  },
]

export function getPlan(key: string | null | undefined): Plan | null {
  return PLANS.find((p) => p.key === key) ?? null
}

/** الباقات اللي بتتدفع — التجربة مش منهم */
export const PAID_PLANS = PLANS.filter((p) => p.price > 0)

export const STATUS_LABEL: Record<string, string> = {
  free: 'الباقة المجانية',
  trial: 'فترة تجريبية',
  active: 'اشتراك نشط',
  past_due: 'انتهى الاشتراك',
  suspended: 'موقوف',
}

/** كام يوم فاضل — رقم سالب معناه انتهت */
export function daysLeft(date: Date | null): number | null {
  if (!date) return null
  return Math.ceil((new Date(date).getTime() - Date.now()) / 86_400_000)
}

/** تاريخ انتهاء فترة الباقة، محسوب من لحظة بدايتها */
export function periodEnd(plan: Plan, from: Date = new Date()): Date {
  const end = new Date(from)
  end.setDate(end.getDate() + plan.days)
  return end
}
