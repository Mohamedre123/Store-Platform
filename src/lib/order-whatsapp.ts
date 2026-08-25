import 'server-only'
import { readTemplates, sendWhatsapp, sendWhatsappDocument } from './whatsapp'
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
  /** معرّف الطلب — للسجل بس، مش بيتحط في نص الرسالة */
  orderId?: string
  phone: string
  /** رابط تتبّع الطلب — بنطاق التاجر */
  trackUrl: string
}

export async function whatsappOrderPlaced(
  store: Store,
  o: OrderMessage & {
    total: number
    currency: string
    cod: boolean
    customerName?: string | null
    /** رابط صفحة الفاتورة — بيتحط جوّه نفس الرسالة */
    invoiceUrl: string
    /** ملف الفاتورة PDF — بيتبعت كمستند مع نفس الرسالة */
    invoicePdfUrl?: string
  },
): Promise<void> {
  const templates = await readTemplates(store.id)
  const text = fillTemplate(templateFor(templates, 'order_placed'), {
    اسم_المتجر: store.name,
    اسم_العميل: o.customerName ?? '',
    رقم_الطلب: String(o.orderNumber),
    الإجمالي: formatMoney(o.total, o.currency),
    طريقة_الدفع: o.cod ? 'عند الاستلام' : 'أونلاين',
    الرابط: o.trackUrl,
    رابط_الفاتورة: o.invoiceUrl,
  })

  if (!text || !o.phone) return

  /**
   * الفاتورة مستند مع نفس الرسالة، مش رسالة تانية.
   *
   * **الباقات المجانية عند مزوّدي واتساب بتسمح برسالة واحدة كل
   * دقيقة.** رسالة تأكيد وبعدها رسالة فاتورة معناها إن التانية
   * بترجع ٤٢٩ وتضيع. المستند بيتبعت والنص بيبقى تعليقه — رسالة
   * واحدة فيها الاتنين.
   *
   * ولو المزوّد رفض المستند (باقة ما بتدعمش المرفقات، أو الملف
   * ما اتجابش)، بنرجع للنص العادي: التأكيد أهم من المرفق، والفاتورة
   * لسه رابطها جوّه النص.
   */
  if (o.invoicePdfUrl) {
    const doc = await sendWhatsappDocument(
      store.id,
      o.phone,
      o.invoicePdfUrl,
      `فاتورة-${o.orderNumber}.pdf`,
      text,
      { event: 'wa_order_placed', orderId: o.orderId },
    )
    if (doc.ok) return
    if (doc.error === 'واتساب مش مربوط') return
    console.error('فشل إرسال الفاتورة كمستند، بنرجع للنص:', doc.error)
  }

  const res = await sendWhatsapp(store.id, o.phone, text, {
    event: 'wa_order_placed',
    orderId: o.orderId,
  })
  if (!res.ok && res.error !== 'واتساب مش مربوط') {
    console.error('فشل إرسال واتساب الطلب:', res.error)
  }
}

/**
 * ## ليه الفاتورة جوّه رسالة التأكيد مش رسالة لوحدها
 *
 * كانت رسالتين: «استلمنا طلبك» وبعدها «دي فاتورتك». والباقات
 * المجانية عند مزوّدي واتساب بتسمح **برسالة واحدة كل دقيقة** —
 * فالتانية كانت بترجع ٤٢٩ وتضيع، والعميل ياخد التأكيد بلا فاتورة.
 *
 * ورسالة واحدة فيها الرابطين أحسن للعميل أصلًا: إشعارين ورا بعض من
 * نفس المتجر في نفس الثانية بيتقروا إزعاجًا.
 *
 * ورابط مش مرفق: صفحة الفاتورة بتتفتح على الفون فورًا، وفيها زرار
 * حفظ PDF لو حبّها ورقة.
 */

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
  }, o.orderId)
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
  /** رقم الطلب اللي الرسالة بتخصّه — عشان السجل يربطها بيه */
  orderId?: string,
): Promise<void> {
  if (!phone) return

  const templates = await readTemplates(store.id)
  const text = fillTemplate(templateFor(templates, key), vars)
  if (!text) return

  const res = await sendWhatsapp(store.id, phone, text, { event: `wa_${key}`, orderId })
  if (!res.ok && res.error !== 'واتساب مش مربوط') {
    console.error('فشل إرسال واتساب الطلب:', res.error)
  }
}
