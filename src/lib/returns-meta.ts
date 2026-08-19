/**
 * حالات المرتجع وأسبابه.
 *
 * من غير `server-only`: نفس القائمة بتستخدمها لوحة التاجر (متصفح)
 * وصفحة الطلب في المتجر — فالمصدر واحد والاتنين بيقروا منه.
 */
export type ReturnStatus = 'requested' | 'approved' | 'rejected' | 'picked_up' | 'received' | 'completed'

export const RETURN_STATUSES: Array<{ key: ReturnStatus; label: string; bg: string; fg: string }> = [
  { key: 'requested', label: 'طلب جديد', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  { key: 'approved', label: 'اتوافق عليه', bg: 'var(--color-info-soft)', fg: 'var(--color-info)' },
  { key: 'picked_up', label: 'اتستلم من العميل', bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  { key: 'received', label: 'وصل المتجر', bg: 'var(--primary-soft)', fg: 'var(--primary)' },
  { key: 'completed', label: 'اكتمل', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  { key: 'rejected', label: 'مرفوض', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
]

export function returnStatusMeta(status: string) {
  return RETURN_STATUSES.find((s) => s.key === status) ?? RETURN_STATUSES[0]
}

/** أسباب الإرجاع الشائعة — قائمة جاهزة أسرع من كتابة نص حر */
export const RETURN_REASONS = [
  'المنتج مختلف عن الصور',
  'المقاس مش مظبوط',
  'المنتج وصل تالف',
  'وصلني منتج غلط',
  'المنتج مش بالجودة المتوقّعة',
  'غيّرت رأيي',
  'سبب تاني',
]
