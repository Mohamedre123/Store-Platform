import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orderItems, orders, paymentAttempts, stores } from '@/db/schema'
import { paymentCreds, recordPaymentError } from '@/lib/provider-store'
import { paymentProvider, webhookPath } from '@/lib/providers'
import { platformOrigin, storeUrl } from '@/lib/domain'
import { createPaymentSession, type PaymentOrder } from '@/lib/integrations/payments'

/**
 * تحويل العميل لصفحة الدفع.
 *
 * الطلب بيتسجّل عندنا الأول وبعدين بنعمل جلسة الدفع — الترتيب ده
 * مقصود: لو البوابة وقعت، التاجر يبقى شايف الطلب ويقدر يكلّم العميل.
 * لو عملنا الجلسة الأول ووقعت، الطلب كان بيختفي وكأن محدش حاول.
 *
 * **الطلب بيفضل «مش مدفوع» بعد التحويل.** الرابط بيوصّل العميل لصفحة
 * الدفع بس؛ اللي بيعلّمه مدفوع هو الويب هوك الموقّع لا رجوع العميل.
 */

export type StartPaymentResult =
  | { ok: true; redirectUrl: string }
  | { ok: false; error: string }

/** الطرق اللي بتتحصّل بره النظام — مالهاش بوابة تتنادى */
export function isOfflineGateway(slug: string): boolean {
  return !paymentProvider(slug)
}

export async function startPayment(
  storeId: string,
  orderId: string,
): Promise<StartPaymentResult> {
  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      total: orders.total,
      currency: orders.currency,
      paymentGateway: orders.paymentGateway,
      paymentStatus: orders.paymentStatus,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      customerEmail: orders.customerEmail,
      shippingAddress: orders.shippingAddress,
      recoveryToken: orders.recoveryToken,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
    .limit(1)

  if (!order) return { ok: false, error: 'الطلب مش موجود' }
  if (order.paymentStatus === 'paid') return { ok: false, error: 'الطلب مدفوع خلاص' }

  const slug = order.paymentGateway ?? ''
  const def = paymentProvider(slug)
  if (!def) return { ok: false, error: 'الطريقة دي مش بوابة أونلاين' }

  const creds = await paymentCreds(storeId, slug)
  if (!creds) return { ok: false, error: `${def.name} مش مربوطة دلوقتي` }

  const [store] = await db
    .select({ name: stores.name, slug: stores.slug })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)

  const items = await db
    .select({ name: orderItems.name, quantity: orderItems.quantity, price: orderItems.price })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))

  const address = (order.shippingAddress ?? {}) as Record<string, string | undefined>

  const payload: PaymentOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    total: order.total,
    currency: order.currency,
    customerName: order.customerName,
    customerPhone: order.customerPhone ?? '',
    customerEmail: order.customerEmail,
    city: address.city ?? null,
    street: address.street ?? null,
    building: address.building ?? null,
    items: items.length
      ? items.map((i) => ({ name: i.name, quantity: i.quantity, price: i.price }))
      : [{ name: `طلب رقم ${order.orderNumber}`, quantity: 1, price: order.total }],
  }

  /*
    مجموع السطور ممكن يختلف عن الإجمالي (شحن، خصم، رسوم). البوابات
    اللي بتتحقّق من المجموع بترفض الفرق ده — فبنبعت سطرًا واحدًا
    بالإجمالي لما يبقى فيه فرق، بدل ما نبعت أرقامًا ما بتجمعش.
  */
  const linesTotal = payload.items.reduce((n, i) => n + i.price * i.quantity, 0)
  if (linesTotal !== order.total) {
    payload.items = [{ name: `طلب رقم ${order.orderNumber}`, quantity: 1, price: order.total }]
  }

  const base = store ? storeUrl(store.slug) : platformOrigin()
  const returnUrl = `${base}/order/${order.orderNumber}?t=${encodeURIComponent(order.recoveryToken ?? '')}`

  const session = await createPaymentSession(slug, {
    creds,
    order: payload,
    returnUrl,
    webhookUrl: platformOrigin() + webhookPath('pay', slug, storeId),
    storeName: store?.name ?? 'المتجر',
  })

  await db
    .insert(paymentAttempts)
    .values({
      storeId,
      orderId,
      gateway: slug,
      amount: order.total,
      currency: order.currency,
      status: session.ok ? 'redirected' : 'failed',
      reference: session.ok ? session.reference : null,
      errorMessage: session.ok ? null : session.error,
      response: (session.raw ?? null) as Record<string, unknown> | null,
    })
    .catch(() => undefined)

  if (!session.ok) {
    /*
      الخطأ بيتسجّل على البوابة عشان التاجر يشوفه على الكارت فورًا.
      البوابة اللي بترفض كل طلب لازم تبان في اللوحة، مش تفضل تخسّر
      طلبات في صمت.
    */
    await recordPaymentError(storeId, slug, session.error)
    return { ok: false, error: session.error }
  }

  await recordPaymentError(storeId, slug, null)

  if (session.reference) {
    await db
      .update(orders)
      .set({ paymentReference: session.reference })
      .where(eq(orders.id, orderId))
      .catch(() => undefined)
  }

  return { ok: true, redirectUrl: session.redirectUrl }
}
