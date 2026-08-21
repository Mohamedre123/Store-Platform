import 'server-only'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  customers,
  inventoryMovements,
  orderEvents,
  orderItems,
  orders,
  products,
  productVariants,
  shipments,
  stores,
} from '@/db/schema'
import { recordAudit } from '@/lib/audit'
import { getStoreTheme } from '@/lib/storefront'
import { isEmailConfigured, sendEmail } from '@/lib/email'
import { isEmailableStatus, orderStatusEmail } from '@/lib/store-emails'
import { storeUrl } from '@/lib/domain'
import { awardOrderPoints } from '@/lib/loyalty'
import { rewardReferralForOrder } from '@/lib/referrals'
import { approveAffiliateCommission, cancelAffiliateCommission } from '@/lib/affiliates'
import { dispatchWebhook } from '@/lib/webhooks'
import { runAutomations } from '@/lib/automation'
import { shipmentStatusMeta, type ShipmentStatus } from '@/lib/carriers'
import { queueShipmentForOrder } from '@/lib/shipment-dispatch'
import type { OrderStatus } from '@/db/schema'

/**
 * تحوّلات حالة الطلب والشحنة — بمعزل عن جلسة التاجر.
 *
 * **ليه مش في `actions.ts` زي ما كانت؟** لأن اللي بيغيّر الحالة مش
 * التاجر بس: بوابة الدفع بتأكّد الدفع، وشركة الشحن بتقول «اتسلّم».
 * دول بينادوا من مسار ويب هوك مالوش جلسة ولا كوكي، و`getDashboardContext`
 * بيوجّه على `/login` — يعني كل إشعار من الشركة كان هيقع.
 *
 * فالمنطق كله هنا، بياخد `storeId` صراحةً ومين بيعمل الإجراء. وفعل
 * اللوحة بقى غلاف رفيع بيجيب السياق ويناديه.
 *
 * الفايدة التانية إن **مسار واحد بس** بيصرف نقاط الولاء وعمولة
 * المسوّق ويبعت رسايل الحالة. لو الويب هوك كان بيكتب في `orders`
 * مباشرة، الطلب كان بيتعلّم «اتسلّم» والنقاط ما تتصرفش.
 */

export type Actor =
  | { type: 'merchant'; userId: string }
  /** البوابة أو شركة الشحن — مفيش مستخدم وراه */
  | { type: 'system'; label: string }

const LABELS: Record<OrderStatus, string> = {
  incomplete: 'ناقص',
  pending: 'قيد الانتظار',
  confirmed: 'مؤكّد',
  processing: 'بيتجهّز',
  shipped: 'اتشحن',
  delivered: 'اتسلّم',
  cancelled: 'ملغي',
  returned: 'مرتجع',
}

type FlowStore = {
  id: string
  name: string
  slug: string
  logoLight: string | null
}

/** بيانات المتجر اللي التحوّلات محتاجاها — للمسارات اللي مالهاش سياق لوحة */
export async function loadFlowStore(storeId: string): Promise<FlowStore | null> {
  const [row] = await db
    .select({ id: stores.id, name: stores.name, slug: stores.slug, logoLight: stores.logoLight })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)

  return row ?? null
}

/**
 * تغيير حالة الطلب.
 *
 * الإلغاء والإرجاع بيرجّعوا الكمية للمخزون. من غير كده التاجر بيلاقي
 * مخزونه ناقص بسبب طلبات اتلغت — ومحدش بيلاحظ غير لما يقف عن البيع.
 */
export async function applyOrderStatus(
  store: FlowStore,
  orderId: string,
  status: OrderStatus,
  actor: Actor,
): Promise<void> {
  const [order] = await db
    .select({
      id: orders.id,
      status: orders.status,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      total: orders.total,
      currency: orders.currency,
      recoveryToken: orders.recoveryToken,
      customerId: orders.customerId,
      trackingNumber: orders.trackingNumber,
      shippingCarrier: orders.shippingCarrier,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, store.id)))
    .limit(1)

  if (!order || order.status === status) return

  const restocking = ['cancelled', 'returned'].includes(status)
  const wasCounted = !['cancelled', 'returned', 'incomplete'].includes(order.status)

  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status,
        isIncomplete: status === 'incomplete',
        confirmedAt: status === 'confirmed' ? new Date() : undefined,
        deliveredAt: status === 'delivered' ? new Date() : undefined,
        paymentStatus: status === 'delivered' ? 'paid' : undefined,
      })
      .where(and(eq(orders.id, orderId), eq(orders.storeId, store.id)))

    if (restocking && wasCounted) {
      const items = await tx
        .select({
          productId: orderItems.productId,
          variantId: orderItems.variantId,
          quantity: orderItems.quantity,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))

      for (const item of items) {
        if (!item.productId) continue

        /**
         * الترجيع لازم يروح لنفس المكان اللي اتخصم منه.
         *
         * لو الطلب كان على متغيّر والترجيع راح للمنتج، مخزون «أحمر XL»
         * يفضل ناقص ومخزون المنتج العام يزيد بالغلط — رقمين غلط بضربة
         * واحدة.
         */
        if (item.variantId) {
          await tx
            .update(productVariants)
            .set({ stock: sql`${productVariants.stock} + ${item.quantity}` })
            .where(
              and(eq(productVariants.id, item.variantId), eq(productVariants.storeId, store.id)),
            )
        } else {
          await tx
            .update(products)
            .set({ stock: sql`${products.stock} + ${item.quantity}` })
            .where(and(eq(products.id, item.productId), eq(products.storeId, store.id)))
        }

        await tx
          .update(products)
          .set({ soldCount: sql`greatest(0, ${products.soldCount} - ${item.quantity})` })
          .where(and(eq(products.id, item.productId), eq(products.storeId, store.id)))

        await tx.insert(inventoryMovements).values({
          storeId: store.id,
          productId: item.productId,
          variantId: item.variantId,
          delta: item.quantity,
          reason: status === 'returned' ? 'return' : 'cancel',
          referenceId: orderId,
          note: `طلب رقم ${order.orderNumber}`,
        })
      }
    }

    await tx.insert(orderEvents).values({
      orderId,
      storeId: store.id,
      type: 'status_changed',
      message:
        actor.type === 'system'
          ? `الحالة اتغيّرت إلى «${LABELS[status]}» — تلقائيًا من ${actor.label}`
          : `الحالة اتغيّرت إلى «${LABELS[status]}»`,
      actorType: actor.type === 'system' ? 'system' : 'merchant',
      actorId: actor.type === 'merchant' ? actor.userId : null,
    })
  })

  await recordAudit({
    storeId: store.id,
    userId: actor.type === 'merchant' ? actor.userId : null,
    action: status === 'cancelled' ? 'order.cancel' : 'order.status_change',
    resource: 'order',
    resourceId: order.id,
    before: { status: order.status },
    after: { status, by: actor.type === 'system' ? actor.label : 'merchant' },
  })

  /**
   * الطلب المؤكّد بيروح لشركة الشحن لوحده.
   *
   * هنا لا في مكان تاني، عشان يشتغل مع التلات مسارات بنفس الطريقة:
   * التاجر بيأكّد بإيده، والبوابة بتأكّد بعد الدفع، والمساعد بيأكّد
   * من الشات. والدالة بتتأكد إن الطلب مالوش شحنة قبل ما تعمل واحدة،
   * فالتأكيد مرتين ما بيعملش بوليصتين.
   *
   * بغير await: الشيك أوت واللوحة ما يصحّش يستنّوا API شركة شحن.
   */
  if (status === 'confirmed') {
    void queueShipmentForOrder(store.id, order.id).catch((e) =>
      console.error('فشل تسجيل الشحنة تلقائيًا:', e),
    )
  }

  /**
   * نقاط الولاء عند التسليم لا عند الطلب.
   *
   * لو منحناها عند الطلب، عميل يطلب ويلغي عشرين مرة يطلع بنقاط من غير
   * ما يشتري حاجة. والدالة نفسها بتتأكد إن الطلب ما اتمنحش قبل كده،
   * فتغيير الحالة ذهابًا وإيابًا ما يمنحش مرتين.
   */
  if (status === 'delivered' && order.customerId) {
    try {
      await awardOrderPoints({
        storeId: store.id,
        customerId: order.customerId,
        orderId: order.id,
        orderTotal: order.total,
        orderNumber: order.orderNumber,
      })
    } catch (e) {
      console.error('فشل منح نقاط الولاء:', e)
    }

    try {
      await rewardReferralForOrder(store.id, order.id)
    } catch (e) {
      console.error('فشل صرف نقاط الإحالة:', e)
    }
  }

  if (status === 'delivered' || status === 'cancelled') {
    void (async () => {
      let customerOrders = 0
      let customerSpent = 0
      if (order.customerId) {
        const [c] = await db
          .select({ ordersCount: customers.ordersCount, totalSpent: customers.totalSpent })
          .from(customers)
          .where(eq(customers.id, order.customerId))
          .limit(1)
        customerOrders = c?.ordersCount ?? 0
        customerSpent = c?.totalSpent ?? 0
      }

      runAutomations(status === 'delivered' ? 'order.delivered' : 'order.cancelled', {
        storeId: store.id,
        storeName: store.name,
        storeSlug: store.slug,
        currency: order.currency,
        orderId: order.id,
        orderNumber: order.orderNumber,
        orderTotal: order.total,
        customerId: order.customerId ?? undefined,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerOrders,
        customerSpent,
        recoveryToken: order.recoveryToken,
      })
    })().catch((e) => console.error('فشل محفّز الأتمتة:', e))
  }

  dispatchWebhook(store.id, 'order.status_changed', {
    orderId: order.id,
    orderNumber: order.orderNumber,
    from: order.status,
    to: status,
  })
  if (status === 'delivered') {
    dispatchWebhook(store.id, 'order.delivered', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      total: order.total,
    })
  } else if (status === 'cancelled') {
    dispatchWebhook(store.id, 'order.cancelled', {
      orderId: order.id,
      orderNumber: order.orderNumber,
    })
  }

  try {
    if (status === 'delivered') await approveAffiliateCommission(order.id)
    else if (restocking) await cancelAffiliateCommission(order.id)
  } catch (e) {
    console.error('فشل تحديث عمولة المسوّق:', e)
  }

  /**
   * إشعار العميل بالحالة الجديدة.
   *
   * برّه المعاملة وبغير await: العميل لازم يتبلّغ، بس لو البريد وقع
   * الحالة تفضل متغيّرة — الحالة اتغيّرت فعلًا والمخزون اتعدّل.
   */
  if (order.customerEmail && isEmailableStatus(status) && isEmailConfigured()) {
    void (async () => {
      const theme = await getStoreTheme(store.id)
      const mail = orderStatusEmail(
        { name: store.name, logo: store.logoLight, primary: theme.custom.identity.primary },
        status,
        {
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          total: order.total,
          currency: order.currency,
          trackingNumber: order.trackingNumber,
          carrier: order.shippingCarrier,
          trackUrl: `${storeUrl(store.slug)}/order/${order.orderNumber}?t=${encodeURIComponent(order.recoveryToken ?? '')}`,
        },
      )
      await sendEmail({
        to: order.customerEmail!,
        ...mail,
        log: {
          storeId: store.id,
          event: `order_${status}`,
          orderId: order.id,
          customerId: order.customerId ?? undefined,
        },
      })
    })().catch((e) => console.error('فشل إرسال بريد حالة الطلب:', e))
  }
}

/**
 * تحديث حالة الشحنة.
 *
 * كل تحديث بيتضاف لسجل الشحنة مش بيستبدل الحالة بس — التاجر بيحتاج
 * يعرف الشحنة فضلت قد إيه في كل مرحلة لما يقيّم شركة الشحن.
 *
 * التسليم والرجوع بيتنقلوا للطلب: من غير كده الطلب يفضل «اتشحن»
 * بعد ما العميل استلم، ونقاط الولاء وعمولة المسوّق ما تتصرفش.
 */
export async function applyShipmentStatus(
  store: FlowStore,
  shipmentId: string,
  status: ShipmentStatus,
  actor: Actor,
  note?: string,
  carrierStatus?: string,
): Promise<{ ok?: boolean; error?: string }> {
  const [row] = await db
    .select({ id: shipments.id, orderId: shipments.orderId, status: shipments.status })
    .from(shipments)
    .where(and(eq(shipments.id, shipmentId), eq(shipments.storeId, store.id)))
    .limit(1)

  if (!row) return { error: 'الشحنة مش موجودة' }
  if (row.status === status) return { ok: true }

  const event = { at: new Date().toISOString(), status, note: note?.trim() || undefined }

  await db.transaction(async (tx) => {
    await tx
      .update(shipments)
      .set({
        status,
        carrierStatus: carrierStatus ?? undefined,
        // الإضافة في SQL لا في الذاكرة: قراءة السجل وكتابته تاني كانت
        // هتضيّع أي حدث اتسجّل بينهم
        events: sql`${shipments.events} || ${JSON.stringify([event])}::jsonb`,
      })
      .where(eq(shipments.id, shipmentId))

    await tx.insert(orderEvents).values({
      orderId: row.orderId,
      storeId: store.id,
      type: 'status_changed',
      message: `الشحنة: ${shipmentStatusMeta(status).label}${note ? ` — ${note}` : ''}`,
      actorType: actor.type === 'system' ? 'system' : 'merchant',
      actorId: actor.type === 'merchant' ? actor.userId : null,
    })
  })

  if (status === 'delivered') await applyOrderStatus(store, row.orderId, 'delivered', actor)
  else if (status === 'returned') await applyOrderStatus(store, row.orderId, 'returned', actor)

  return { ok: true }
}
