/**
 * أنواع المكافآت ووجهات الزرار — **للجهتين**.
 *
 * ملف مستقل عن `notice-rewards.ts` لأن ده `server-only`: شاشة
 * الإدارة مكوّن عميل ومحتاجة نفس القايمة اللي الخادم بيتحقّق بيها.
 * لو كل جهة كتبت قايمتها، الإدارة بتختار وجهة والخادم يرفضها.
 */

import { formatCount } from './utils'

export type RewardKind = 'none' | 'free_days' | 'link'

export const REWARD_KINDS: Array<{
  key: RewardKind
  label: string
  hint: string
  /** النص اللي بيتحط في الزرار لوحده — والإدارة تقدر تغيّره */
  defaultLabel: string
}> = [
  {
    key: 'free_days',
    label: 'اشتراك مجاني',
    hint: 'التاجر بيدوس والاشتراك بيتمدّ على طول — من غير ما يكلّم حد',
    defaultLabel: 'فعّل مكافأتك',
  },
  {
    key: 'link',
    label: 'يوديه لصفحة',
    hint: 'الزرار بيفتحله صفحة في لوحته — تختارها من القايمة',
    defaultLabel: 'افتح الصفحة',
  },
  {
    key: 'none',
    label: 'من غير زرار',
    hint: 'رسالة تتقرا وبس — زي التهنئة',
    defaultLabel: '',
  },
]

/** المدد الجاهزة — الإدارة بتدوس واحدة بدل ما تكتب رقم */
export const REWARD_DAY_PRESETS = [
  { days: 7, label: 'أسبوع' },
  { days: 14, label: 'أسبوعين' },
  { days: 30, label: 'شهر' },
  { days: 60, label: 'شهرين' },
  { days: 90, label: '٣ شهور' },
  { days: 365, label: 'سنة' },
]

/**
 * وجهات الزرار — **قايمة مقفولة**.
 *
 * الرابط المكتوب بالإيد كان بيتيح `javascript:` لو اتلزق بالغلط،
 * وكان بيتيح مسارًا مش موجود يوصّل التاجر على ٤٠٤. والأهم إن اللي
 * بيكتب الرسالة مش مبرمج ومش المفروض يعرف مسارات اللوحة أصلًا.
 */
export const NOTICE_DESTINATIONS: Array<{ href: string; label: string }> = [
  { href: '/dashboard/subscription', label: 'الاشتراك والباقات' },
  { href: '/dashboard/referrals', label: 'رابط الإحالة' },
  { href: '/dashboard/products/new', label: 'إضافة منتج' },
  { href: '/dashboard/orders', label: 'الطلبات' },
  { href: '/dashboard/marketing', label: 'التسويق' },
  { href: '/dashboard/marketing/campaigns', label: 'الحملات' },
  { href: '/dashboard/analytics', label: 'التحليلات' },
  { href: '/dashboard/analytics/signal', label: 'جودة إشارة الإعلانات' },
  { href: '/dashboard/markets', label: 'الأسواق والعملات' },
  { href: '/dashboard/storefront/customize', label: 'تخصيص شكل المتجر' },
  { href: '/dashboard/loyalty', label: 'نقاط الولاء' },
  { href: '/dashboard/plugins', label: 'الإضافات' },
  { href: '/dashboard/settings/domain', label: 'ربط النطاق' },
  { href: '/dashboard/settings/team', label: 'فريق العمل' },
]

export function isKnownDestination(href: string): boolean {
  return NOTICE_DESTINATIONS.some((d) => d.href === href)
}

/**
 * وصف المكافأة بجملة — للمعاينة ولسطر السجل.
 *
 * الإدارة بتقرا الجملة دي قبل ما تحفظ، فلازم تقول اللي هيحصل
 * بالظبط لا اسم النوع: «التاجر هياخد ٣٠ يوم» أوضح من «free_days».
 */
export function describeReward(kind: RewardKind, days: number, href: string | null): string {
  if (kind === 'free_days') {
    return `الزرار بيمدّ اشتراك التاجر ${formatCount(days)} يوم على طول`
  }
  if (kind === 'link') {
    const dest = NOTICE_DESTINATIONS.find((d) => d.href === href)
    return dest ? `الزرار بيوديه لصفحة «${dest.label}»` : 'اختار الصفحة اللي الزرار يوديه لها'
  }
  return 'رسالة من غير زرار'
}
