import 'server-only'
import { readTemplates, sendWhatsapp } from './whatsapp'
import { fillTemplate, templateFor, type TemplateKey } from './whatsapp-templates'
import { formatMoney } from './utils'

/**
 * رسايل الطلب على واتساب.
 *
 * **العميل اللي مساب بريده كان بيضيع.** الطلب بيتسجّل، وحالته
 * بتتغيّر في حسابه، وما بيوصلهوش أي خبر — ولو مش فاتح المتجر مش
 * هيعرف إن طلبه اتشحن. وأغلب عملاء الشراء من الموبايل بيسيبوا خانة
 * البريد فاضية أصلًا.
 *
 * الواتساب بيقفل الفجوة دي: الرقم مطلوب في الطلب أصلًا، فمفيش عميل
 * من غير طريق نوصله بيه.
 *
 * ولو الواتساب مش مربوط، الدوال دي بتسكت — الطلب ما يقعش عشان
 * إشعار ما اتبعتش.
 */

type Store = { id: string; name: string }

export type OrderMessage = {
  orderNumber: number
  phone: string
  /** رابط تتبّع الطلب — بنطاق التاجر */
  trackUrl: string
}

export async function whatsappOrderPlaced(
  store: Store,
  o: OrderMessage & { total: number; currency: string; cod: boolean; customerName?: string | null },
): Promise<void> {
  await send(store, o.phone, 'order_placed', {
    اسم_المتجر: store.name,
    اسم_العميل: o.customerName ?? '',
    رقم_الطلب: String(o.orderNumber),
    الإجمالي: formatMoney(o.total, o.currency),
    طريقة_الدفع: o.cod ? 'عند الاستلام' : 'أونلاين',
    الرابط: o.trackUrl,
  })
}

/** الحالات اللي ليها رسالة — الباقي بيعدّي بلا إزعاج */
const STATUS_KEYS = new Set<TemplateKey>([
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
])

export function whatsappHasStatusText(status: string): boolean {
  return STATUS_KEYS.has(status as TemplateKey)
}

export async function whatsappOrderStatus(
  store: Store,
  o: OrderMessage & { status: string; customerName?: string | null },
): Promise<void> {
  if (!whatsappHasStatusText(o.status)) return

  await send(store, o.phone, o.status as TemplateKey, {
    اسم_المتجر: store.name,
    اسم_العميل: o.customerName ?? '',
    رقم_الطلب: String(o.orderNumber),
    الرابط: o.trackUrl,
  })
}

/**
 * بيجيب نص التاجر، يملاه، ويبعت.
 *
 * النص الفاضي بعد الملء معناه إن التاجر مسحه عن قصد — فمفيش
 * رسالة. إرسال رسالة فاضية أسوأ من عدم الإرسال.
 */
async function send(
  store: Store,
  phone: string,
  key: TemplateKey,
  vars: Record<string, string>,
): Promise<void> {
  if (!phone) return

  const templates = await readTemplates(store.id)
  const text = fillTemplate(templateFor(templates, key), vars)
  if (!text) return

  const res = await sendWhatsapp(store.id, phone, text)
  if (!res.ok && res.error !== 'واتساب مش مربوط') {
    console.error('فشل إرسال واتساب الطلب:', res.error)
  }
}
