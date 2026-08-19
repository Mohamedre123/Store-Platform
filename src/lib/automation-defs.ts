/**
 * تعريفات محرّك الأتمتة.
 *
 * القاعدة = محفّز + شروط + إجراءات. لما يحصل المحفّز، المحرّك بيتأكد
 * إن كل الشروط متحققة، وبعدين ينفّذ الإجراءات بالترتيب.
 *
 * الملف ده مشترك بين الخادم والمحرّر — من غير `server-only`.
 */

export type TriggerKey =
  | 'order.created'
  | 'order.delivered'
  | 'order.cancelled'
  | 'cart.abandoned'
  | 'customer.created'
  | 'product.low_stock'

export type FieldType = 'number' | 'money' | 'text' | 'select'

export type FieldDef = {
  key: string
  label: string
  type: FieldType
  options?: Array<{ value: string; label: string }>
}

export type TriggerDef = {
  key: TriggerKey
  label: string
  hint: string
  /** الحقول المتاحة للشروط في المحفّز ده */
  fields: FieldDef[]
}

export const TRIGGERS: TriggerDef[] = [
  {
    key: 'order.created',
    label: 'طلب جديد',
    hint: 'أول ما العميل يكمّل طلبه.',
    fields: [
      { key: 'orderTotal', label: 'إجمالي الطلب', type: 'money' },
      { key: 'itemCount', label: 'عدد المنتجات', type: 'number' },
      { key: 'city', label: 'المحافظة', type: 'text' },
      { key: 'customerOrders', label: 'عدد طلبات العميل السابقة', type: 'number' },
      {
        key: 'paymentMethod',
        label: 'طريقة الدفع',
        type: 'select',
        options: [
          { value: 'cod', label: 'عند الاستلام' },
          { value: 'online', label: 'إلكتروني' },
        ],
      },
    ],
  },
  {
    key: 'order.delivered',
    label: 'تسليم طلب',
    hint: 'لما التاجر يحوّل الحالة لـ«اتسلّم».',
    fields: [
      { key: 'orderTotal', label: 'إجمالي الطلب', type: 'money' },
      { key: 'customerOrders', label: 'عدد طلبات العميل', type: 'number' },
      { key: 'customerSpent', label: 'إجمالي إنفاق العميل', type: 'money' },
    ],
  },
  {
    key: 'order.cancelled',
    label: 'إلغاء طلب',
    hint: 'لما الطلب يتلغي.',
    fields: [{ key: 'orderTotal', label: 'إجمالي الطلب', type: 'money' }],
  },
  {
    key: 'cart.abandoned',
    label: 'سلة متروكة',
    hint: 'العميل كتب رقمه ومكمّلش الطلب.',
    fields: [
      { key: 'orderTotal', label: 'قيمة السلة', type: 'money' },
      { key: 'itemCount', label: 'عدد المنتجات', type: 'number' },
    ],
  },
  {
    key: 'customer.created',
    label: 'عميل جديد',
    hint: 'أول مرة العميل يطلب من متجرك.',
    fields: [{ key: 'city', label: 'المحافظة', type: 'text' }],
  },
  {
    key: 'product.low_stock',
    label: 'مخزون منخفض',
    hint: 'لما كمية منتج توصل لحد التنبيه.',
    fields: [{ key: 'stock', label: 'الكمية المتبقية', type: 'number' }],
  },
]

export const OPERATORS: Array<{ value: string; label: string; types: FieldType[] }> = [
  { value: 'gte', label: 'أكبر من أو يساوي', types: ['number', 'money'] },
  { value: 'lte', label: 'أصغر من أو يساوي', types: ['number', 'money'] },
  { value: 'eq', label: 'يساوي', types: ['number', 'money', 'text', 'select'] },
  { value: 'neq', label: 'لا يساوي', types: ['number', 'money', 'text', 'select'] },
  { value: 'contains', label: 'يحتوي على', types: ['text'] },
]

export type ActionKey =
  | 'send_email'
  | 'add_points'
  | 'issue_coupon'
  | 'order_note'
  | 'set_status'
  | 'call_webhook'

export type ActionDef = {
  key: ActionKey
  label: string
  hint: string
  /** المحفّزات اللي الإجراء ده منطقي معاها */
  triggers?: TriggerKey[]
}

export const ACTIONS: ActionDef[] = [
  {
    key: 'send_email',
    label: 'ابعت بريدًا للعميل',
    hint: 'رسالة بهوية متجرك — بتحتاج بريد العميل.',
  },
  {
    key: 'add_points',
    label: 'ضيف نقاط ولاء',
    hint: 'مكافأة إضافية فوق نقاط الطلب العادية.',
  },
  {
    key: 'issue_coupon',
    label: 'ولّد كوبون خصم',
    hint: 'كود لمرة واحدة، بيتبعت في البريد لو فعّلته.',
  },
  {
    key: 'order_note',
    label: 'ضيف ملاحظة على الطلب',
    hint: 'ملاحظة داخلية تشوفها إنت بس.',
    triggers: ['order.created', 'order.delivered', 'order.cancelled', 'cart.abandoned'],
  },
  {
    key: 'set_status',
    label: 'غيّر حالة الطلب',
    hint: 'مثلًا: أكّد الطلبات الصغيرة تلقائيًا.',
    triggers: ['order.created'],
  },
  {
    key: 'call_webhook',
    label: 'نادِ رابطًا خارجيًا',
    hint: 'POST بحمولة الحدث لأي رابط.',
  },
]

export function triggerDef(key: string) {
  return TRIGGERS.find((t) => t.key === key)
}

export function actionsFor(trigger: string) {
  return ACTIONS.filter((a) => !a.triggers || a.triggers.includes(trigger as TriggerKey))
}
