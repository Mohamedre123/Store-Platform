/** أحداث الويب هوك — مشتركة بين الخادم ولوحة المطوّرين */
export const WEBHOOK_EVENTS = [
  { key: 'order.created', label: 'طلب جديد' },
  { key: 'order.status_changed', label: 'تغيّر حالة طلب' },
  { key: 'order.delivered', label: 'تسليم طلب' },
  { key: 'order.cancelled', label: 'إلغاء طلب' },
  { key: 'customer.created', label: 'عميل جديد' },
  { key: 'product.low_stock', label: 'مخزون منخفض' },
  { key: 'return.requested', label: 'طلب إرجاع' },
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]['key']
