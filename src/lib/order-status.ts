import type { OrderStatus } from '@/db/schema'

/**
 * حالات الطلب.
 *
 * اللون هنا مش تجميل — التاجر بيفتح صفحة فيها ٥٠ طلب وبيحتاج يعرف
 * من نظرة إيه اللي محتاج تدخّل. الأحمر والبرتقالي بيلفتوا، والرمادي
 * بيقول «خلص وما يحتاجش منك حاجة».
 */

export type StatusMeta = {
  key: OrderStatus
  label: string
  bg: string
  fg: string
  /** ترتيب المسار الطبيعي — لتحديد الخطوة التالية المقترحة */
  step: number | null
}

export const ORDER_STATUSES: StatusMeta[] = [
  { key: 'incomplete', label: 'ناقص', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)', step: null },
  { key: 'pending', label: 'قيد الانتظار', bg: 'var(--color-info-soft)', fg: 'var(--color-info)', step: 0 },
  { key: 'confirmed', label: 'مؤكّد', bg: 'var(--primary-soft)', fg: 'var(--primary)', step: 1 },
  { key: 'processing', label: 'بيتجهّز', bg: 'var(--primary-soft)', fg: 'var(--primary)', step: 2 },
  { key: 'shipped', label: 'اتشحن', bg: 'var(--color-info-soft)', fg: 'var(--color-info)', step: 3 },
  { key: 'delivered', label: 'اتسلّم', bg: 'var(--color-success-soft)', fg: 'var(--color-success)', step: 4 },
  { key: 'cancelled', label: 'ملغي', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)', step: null },
  { key: 'returned', label: 'مرتجع', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)', step: null },
]

export function statusMeta(status: string): StatusMeta {
  return ORDER_STATUSES.find((s) => s.key === status) ?? ORDER_STATUSES[1]
}

/** الخطوة اللي المنطقي التاجر يعملها بعد الحالة الحالية */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  const order: OrderStatus[] = ['pending', 'confirmed', 'processing', 'shipped', 'delivered']
  const index = order.indexOf(status)
  if (index === -1 || index === order.length - 1) return null
  return order[index + 1]
}
