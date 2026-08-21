import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orderEvents, orderItems, orders, shipments, stores } from '@/db/schema'
import { activeCarrier, carrierCreds, recordCarrierError } from '@/lib/provider-store'
import { carrierProvider, webhookPath } from '@/lib/providers'
import { platformOrigin } from '@/lib/domain'
import { createCarrierShipment, supportsAutoShipment, type ShipmentOrder } from '@/lib/integrations/shipping'

/**
 * تسجيل الطلب عند شركة الشحن المربوطة.
 *
 * بيتنادى لما الطلب يتأكّد: التاجر يأكّده بإيده، أو البوابة تأكّد
 * الدفع. اللي بيحصل: بنبعت الطلب للشركة، ناخد رقم البوليصة، نسجّل
 * شحنة عندنا، ونكتب الرقم على الطلب فرسالة «طلبك اتشحن» تخرج بيه.
 *
 * **ما بيرميش أبدًا، وما بيلغيش الطلب.** لو الشركة رفضت، بنسجّل
 * السبب على حسابها فيظهر للتاجر على الكارت، والطلب يفضل زي ما هو
 * عشان التاجر يعمل الشحنة بإيده. طلب بيتلغي عشان API واقع خسارة
 * مباشرة للتاجر.
 *
 * ولو الطلب عليه شحنة أصلًا، بنخرج من غير ما نعمل حاجة — تأكيد
 * الطلب مرتين ما يصحّش يعمل بوليصتين والعميل يستلم مرتين.
 */
export async function queueShipmentForOrder(
  storeId: string,
  orderId: string,
): Promise<{ ok: boolean; trackingNumber?: string; error?: string }> {
  const carrier = await activeCarrier(storeId)
  if (!carrier) return { ok: false, error: 'مفيش شركة شحن مربوطة' }

  const def = carrierProvider(carrier.slug)
  if (!def || !supportsAutoShipment(carrier.slug)) {
    return { ok: false, error: 'الشركة دي بتتسجّل يدويًا' }
  }

  // شحنة موجودة؟ يبقى الطلب اتبعت قبل كده
  const [existing] = await db
    .select({ id: shipments.id, trackingNumber: shipments.trackingNumber })
    .from(shipments)
    .where(and(eq(shipments.storeId, storeId), eq(shipments.orderId, orderId)))
    .limit(1)

  if (existing) {
    return { ok: true, trackingNumber: existing.trackingNumber ?? undefined }
  }

  const creds = await carrierCreds(storeId, carrier.slug)
  if (!creds) return { ok: false, error: 'مفاتيح الشركة ناقصة' }

  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      total: orders.total,
      currency: orders.currency,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      customerEmail: orders.customerEmail,
      shippingAddress: orders.shippingAddress,
      notes: orders.notes,
      shippingTotal: orders.shippingTotal,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
    .limit(1)

  if (!order) return { ok: false, error: 'الطلب مش موجود' }

  const [store] = await db
    .select({ name: stores.name, phone: stores.phone, country: stores.country })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)

  const items = await db
    .select({ name: orderItems.name, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId))

  const address = (order.shippingAddress ?? {}) as Record<string, string | undefined>

  /**
   * المبلغ المطلوب تحصيله.
   *
   * الطلب المدفوع أونلاين بيروح للشركة بتحصيل **صفر**. لو بعتناه
   * بإجماليه، المندوب بيطلب فلوس من عميل دفع خلاص — والعميل بيرفض
   * الاستلام، والطلب بيرجع، والتاجر بيدفع شحن رايح جاي على غلطة
   * رقم واحد.
   */
  const codAmount = order.paymentStatus === 'paid' ? 0 : order.total

  const payload: ShipmentOrder = {
    id: order.id,
    orderNumber: order.orderNumber,
    total: order.total,
    codAmount,
    currency: order.currency,
    customerName: order.customerName,
    customerPhone: order.customerPhone ?? '',
    customerEmail: order.customerEmail,
    country: address.country ?? store?.country ?? 'EG',
    city: address.city ?? null,
    area: address.area ?? null,
    street: address.street ?? null,
    building: address.building ?? null,
    notes: order.notes,
    itemsCount: items.reduce((n, i) => n + i.quantity, 0) || 1,
    description: items.map((i) => `${i.name} ×${i.quantity}`).join('، ').slice(0, 200) || 'طلب',
  }

  const result = await createCarrierShipment(carrier.slug, {
    creds,
    order: payload,
    storeName: store?.name ?? 'المتجر',
    storePhone: store?.phone ?? null,
    webhookUrl: platformOrigin() + webhookPath('ship', carrier.slug, storeId),
  })

  if (!result.ok) {
    await recordCarrierError(storeId, carrier.slug, result.error)

    /*
      الفشل بيتسجّل على الطلب كمان لا على حساب الشركة بس: التاجر
      اللي بيفتح الطلب لازم يعرف إنه محتاج يعمل البوليصة بإيده،
      من غير ما يروح يقارن صفحة الشحن بصفحة الطلبات.
    */
    await db.insert(orderEvents).values({
      orderId,
      storeId,
      type: 'note',
      message: `ما اتسجّلتش شحنة عند ${def.name}: ${result.error}. سجّلها بإيدك من صفحة الشحنات.`,
      actorType: 'carrier',
    })

    return { ok: false, error: result.error }
  }

  await db.transaction(async (tx) => {
    await tx.insert(shipments).values({
      storeId,
      orderId,
      carrier: carrier.slug,
      trackingNumber: result.trackingNumber,
      carrierShipmentId: result.carrierShipmentId,
      awbUrl: result.awbUrl,
      status: 'created',
      codAmount,
      shippingCost: order.shippingTotal,
      events: [{ at: new Date().toISOString(), status: 'created', note: `اتسجّلت تلقائيًا عند ${def.name}` }],
      raw: result.raw as Record<string, unknown>,
    })

    await tx
      .update(orders)
      .set({ trackingNumber: result.trackingNumber, shippingCarrier: carrier.slug })
      .where(eq(orders.id, orderId))

    await tx.insert(orderEvents).values({
      orderId,
      storeId,
      type: 'note',
      message: `اتسجّلت شحنة تلقائيًا عند ${def.name} — بوليصة ${result.trackingNumber}`,
      actorType: 'carrier',
    })
  })

  await recordCarrierError(storeId, carrier.slug, null)

  return { ok: true, trackingNumber: result.trackingNumber }
}
