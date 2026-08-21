import { NextResponse, type NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orders, paymentAttempts, paymentMethods } from '@/db/schema'
import { paymentSecrets, recordPaymentError } from '@/lib/provider-store'
import { paymentProvider } from '@/lib/providers'
import { orderNumberFromRef } from '@/lib/integrations/payments'
import { verifyFawry, verifyHmac, verifyPaymob } from '@/lib/webhook-verify'
import { applyOrderStatus, loadFlowStore } from '@/lib/order-flow'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

/**
 * تأكيد الدفع من البوابة.
 *
 * **الطلب ما بيبقاش «مدفوع» لما العميل يرجع من صفحة الدفع.**
 * صفحة الرجوع مجرد رابط وأي حد يفتحه — لو صدّقناها، حد يفتح الرابط
 * ويطلع بطلب مدفوع من غير ما يدفع جنيه.
 *
 * الحقيقة الوحيدة هي المسار ده: البوابة بتنده علينا من سيرفرها
 * بحمولة **موقّعة**، وإحنا بنتحقّق من التوقيع قبل ما نلمس أي طلب.
 *
 * ومسار عام من غير تحقّق أسوأ من مفيش مسار: بيدّي أي حد زرار
 * «علّم الطلب مدفوع».
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string; storeId: string }> },
) {
  const { slug, storeId } = await params

  const def = paymentProvider(slug)
  if (!def) return NextResponse.json({ error: 'unknown provider' }, { status: 404 })

  // النص الخام لازم يتقرا قبل أي تحليل — التوقيع محسوب عليه بايتًا بايت
  const raw = await req.text()

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'bad payload' }, { status: 400 })
  }

  const [method] = await db
    .select({ id: paymentMethods.id, enabled: paymentMethods.enabled })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.storeId, storeId), eq(paymentMethods.gateway, slug)))
    .limit(1)

  if (!method) return NextResponse.json({ error: 'not connected' }, { status: 404 })

  const secrets = await paymentSecrets(storeId, slug)
  if (!secrets) return NextResponse.json({ error: 'no credentials' }, { status: 404 })

  /* ─────────── التحقّق ─────────── */

  let verified = false
  let reference = ''
  let paid = false
  let orderRef = ''

  if (slug === 'paymob') {
    const hmac = req.nextUrl.searchParams.get('hmac') ?? req.headers.get('hmac') ?? ''
    verified = verifyPaymob(payload, hmac, secrets.hmacSecret ?? '')
    const obj = (payload.obj ?? payload) as Record<string, unknown>
    const order = obj.order as Record<string, unknown> | undefined
    reference = String(obj.id ?? '')
    orderRef = String(order?.merchant_order_id ?? '')
    paid = obj.success === true && obj.pending !== true
  } else if (slug === 'fawry') {
    verified = verifyFawry(payload, secrets.securityKey ?? '')
    reference = String(payload.fawryRefNumber ?? '')
    orderRef = String(payload.merchantRefNumber ?? '')
    paid = String(payload.orderStatus ?? '').toUpperCase() === 'PAID'
  } else if (slug === 'kashier') {
    const sig = req.headers.get('x-kashier-signature') ?? ''
    verified = verifyHmac(raw, sig, secrets.secretKey ?? '')
    const data = (payload.data ?? payload) as Record<string, unknown>
    reference = String(data.transactionId ?? '')
    orderRef = String(data.merchantOrderId ?? data.orderId ?? '')
    paid = String(data.status ?? '').toUpperCase() === 'SUCCESS'
  } else if (slug === 'stripe') {
    const sig = req.headers.get('stripe-signature') ?? ''
    verified = verifyHmac(raw, sig, secrets.webhookSecret ?? '')
    const obj = ((payload.data as Record<string, unknown>)?.object ?? {}) as Record<string, unknown>
    reference = String(obj.id ?? '')
    orderRef = String(
      (obj.metadata as Record<string, unknown>)?.orderNumber ?? obj.client_reference_id ?? '',
    )
    paid = ['checkout.session.completed', 'payment_intent.succeeded'].includes(
      String(payload.type ?? ''),
    )
  } else if (slug === 'tabby' || slug === 'tamara' || slug === 'myfatoorah' || slug === 'paypal') {
    const sig =
      req.headers.get('x-tabby-signature') ??
      req.headers.get('tamara-signature') ??
      req.headers.get('x-signature') ??
      ''
    const secret = secrets.secretKey ?? secrets.notificationToken ?? secrets.apiToken ?? ''
    verified = verifyHmac(raw, sig, secret)
    reference = String(payload.id ?? payload.order_id ?? '')
    orderRef = String(payload.order_reference_id ?? payload.reference_id ?? '')
    paid = ['authorized', 'approved', 'captured', 'paid', 'completed'].includes(
      String(payload.status ?? '').toLowerCase(),
    )
  }

  if (!verified) {
    /*
      الرفض بيتسجّل: محاولة بتوقيع غلط يا إما إعداد ناقص عند التاجر
      يا إما حد بيجرّب. الاتنين التاجر لازم يشوفهم.
    */
    await db
      .insert(paymentAttempts)
      .values({
        storeId,
        gateway: slug,
        status: 'failed',
        reference: reference || null,
        errorCode: 'bad_signature',
        errorMessage: 'التوقيع مش مطابق — الإشعار اترفض',
        response: payload,
      })
      .catch(() => undefined)

    await recordPaymentError(
      storeId,
      slug,
      'وصل إشعار دفع بتوقيع مش مطابق. راجع سرّ الويب هوك عندهم.',
    )

    return NextResponse.json({ error: 'invalid signature' }, { status: 401 })
  }

  /* ─────────── التطبيق ─────────── */

  const orderNumber = orderNumberFromRef(orderRef)
  if (orderNumber <= 0) {
    return NextResponse.json({ ok: true, note: 'no order reference' })
  }

  const [order] = await db
    .select({ id: orders.id, status: orders.status, paymentStatus: orders.paymentStatus })
    .from(orders)
    .where(and(eq(orders.storeId, storeId), eq(orders.orderNumber, orderNumber)))
    .limit(1)

  if (!order) return NextResponse.json({ ok: true, note: 'order not found' })

  await db.insert(paymentAttempts).values({
    storeId,
    orderId: order.id,
    gateway: slug,
    status: paid ? 'succeeded' : 'failed',
    reference: reference || null,
    response: payload,
  })

  if (paid && order.paymentStatus !== 'paid') {
    await db
      .update(orders)
      .set({ paymentStatus: 'paid', paymentReference: reference || null })
      .where(eq(orders.id, order.id))

    await recordPaymentError(storeId, slug, null)

    /*
      الطلب المدفوع بيتأكّد تلقائي.
      بننادي التحوّل نفسه اللي اللوحة بتناديه لا كتابة مباشرة —
      الرسالة للعميل والويب هوك والأتمتة كلهم متعلّقين بيه.
    */
    const store = await loadFlowStore(storeId)
    if (store && order.status === 'pending') {
      await applyOrderStatus(store, order.id, 'confirmed', {
        type: 'system',
        label: def.name,
      }).catch((e) => console.error('فشل تأكيد الطلب بعد الدفع:', e))
    }
  }

  return NextResponse.json({ ok: true })
}
