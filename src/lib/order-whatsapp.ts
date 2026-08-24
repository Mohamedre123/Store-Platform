import 'server-only'
import { sendWhatsapp } from './whatsapp'
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
  o: OrderMessage & { total: number; currency: string; cod: boolean },
): Promise<void> {
  await send(store, o.phone, [
    `أهلًا 👋 استلمنا طلبك من ${store.name}`,
    ``,
    `رقم الطلب: #${o.orderNumber}`,
    `الإجمالي: ${formatMoney(o.total, o.currency)}`,
    o.cod ? `الدفع: عند الاستلام` : `الدفع: أونلاين`,
    ``,
    `تقدر تتابع حالته من هنا:`,
    o.trackUrl,
  ])
}

/**
 * نصوص الحالات.
 *
 * مكتوبة بصيغة الخبر لا بصيغة النظام: «طلبك خرج مع المندوب» بتقول
 * للعميل يعمل إيه، و«الحالة اتغيّرت لـshipped» ما بتقولش حاجة.
 */
const STATUS_TEXT: Record<string, (n: number) => string> = {
  confirmed: (n) => `طلبك #${n} اتأكد وبنجهّزه دلوقتي ✅`,
  processing: (n) => `طلبك #${n} تحت التجهيز 📦`,
  shipped: (n) => `طلبك #${n} خرج مع المندوب 🚚 — استنّى مكالمته`,
  delivered: (n) => `طلبك #${n} اتسلّم ✅ — شكرًا إنك اشتريت مننا`,
  cancelled: (n) => `طلبك #${n} اتلغى. لو ده مش صح كلّمنا وهنظبّطها`,
  returned: (n) => `طلب الإرجاع للطلب #${n} اتسجّل`,
}

export function whatsappHasStatusText(status: string): boolean {
  return status in STATUS_TEXT
}

export async function whatsappOrderStatus(
  store: Store,
  o: OrderMessage & { status: string },
): Promise<void> {
  const line = STATUS_TEXT[o.status]
  if (!line) return

  await send(store, o.phone, [line(o.orderNumber), ``, `تفاصيل الطلب:`, o.trackUrl])
}

async function send(store: Store, phone: string, lines: string[]): Promise<void> {
  if (!phone) return
  const res = await sendWhatsapp(store.id, phone, lines.join('\n'))
  if (!res.ok && res.error !== 'واتساب مش مربوط') {
    console.error('فشل إرسال واتساب الطلب:', res.error)
  }
}
