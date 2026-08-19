/**
 * ثوابت المكافآت والمستويات.
 *
 * منفصلة عن `rewards.ts` عن قصد: الملف ده `server-only` لأنه بيلمس
 * قاعدة البيانات، ونماذج التاجر والعميل مكوّنات متصفح محتاجة نفس
 * الأسماء. لو استوردوا منه، البناء بيقع بخطأ استيراد كود خادم في
 * المتصفح — والخطأ ده مش بيبان في فحص الأنواع، بيبان وقت التشغيل.
 */

export const TIER_ORDER = ['bronze', 'silver', 'gold', 'platinum'] as const
export type Tier = (typeof TIER_ORDER)[number]

export const TIER_LABELS: Record<Tier, string> = {
  bronze: 'برونزي',
  silver: 'فضّي',
  gold: 'ذهبي',
  platinum: 'بلاتيني',
}

export const REWARD_TYPES = [
  { key: 'coupon_percent', label: 'خصم بنسبة', unit: '٪' },
  { key: 'coupon_fixed', label: 'خصم بمبلغ', unit: 'ج' },
  { key: 'free_shipping', label: 'شحن مجاني', unit: null },
  { key: 'free_product', label: 'منتج مجاني', unit: null },
] as const

export function rewardTypeLabel(type: string) {
  return REWARD_TYPES.find((t) => t.key === type)?.label ?? type
}

/** هل مستوى العميل يكفي للمكافأة؟ */
export function tierAllows(customerTier: string, minTier: string | null): boolean {
  if (!minTier) return true
  const need = TIER_ORDER.indexOf(minTier as Tier)
  const have = TIER_ORDER.indexOf(customerTier as Tier)
  return have >= need
}
