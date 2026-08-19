'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, inventoryMovements, orderEvents, orderItems, orders, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { getStoreTheme } from '@/lib/storefront'
import { isEmailConfigured, sendEmail } from '@/lib/email'
import { isEmailableStatus, orderStatusEmail } from '@/lib/store-emails'
import { storeUrl } from '@/lib/domain'
import { awardOrderPoints } from '@/lib/loyalty'
import { approveAffiliateCommission, cancelAffiliateCommission } from '@/lib/affiliates'
import { dispatchWebhook } from '@/lib/webhooks'
import { runAutomations } from '@/lib/automation'
import type { OrderStatus } from '@/db/schema'

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

/**
 * تغيير حالة الطلب.
 *
 * الإلغاء والإرجاع بيرجّعوا الكمية للمخزون. من غير كده التاجر بيلاقي
 * مخزونه ناقص بسبب طلبات اتلغت — ومحدش بيلاحظ غير لما يقف عن البيع.
 */
export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  const { store, user } = await getDashboardContext()

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
        .select({ productId: orderItems.productId, quantity: orderItems.quantity })
        .from(orderItems)
        .where(eq(orderItems.orderId, orderId))

      for (const item of items) {
        if (!item.productId) continue
        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} + ${item.quantity}`,
            soldCount: sql`greatest(0, ${products.soldCount} - ${item.quantity})`,
          })
          .where(and(eq(products.id, item.productId), eq(products.storeId, store.id)))

        await tx.insert(inventoryMovements).values({
          storeId: store.id,
          productId: item.productId,
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
      message: `الحالة اتغيّرت إلى «${LABELS[status]}»`,
      actorType: 'merchant',
      actorId: user.id,
    })
  })

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
  }

  /**
   * محفّزات الأتمتة على التسليم والإلغاء.
   *
   * بيانات العميل بتتقرا هنا عشان الشروط اللي بتعتمد عليها (إجمالي
   * إنفاقه، عدد طلباته) تبقى بقيمتها بعد الطلب ده.
   */
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

  // إشعار الأنظمة الخارجية بتغيّر الحالة
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

  /**
   * عمولة المسوّق: بتتعتمد عند التسليم وبتتلغي مع الإلغاء أو الإرجاع.
   * نفس منطق النقاط — العمولة على بيعة اتلغت خسارة مباشرة للتاجر.
   */
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
   * الحالة تفضل متغيّرة — التاجر غيّرها فعلًا والمخزون اتعدّل.
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
      await sendEmail({ to: order.customerEmail!, ...mail })
    })().catch((e) => console.error('فشل إرسال بريد حالة الطلب:', e))
  }

  revalidatePath('/dashboard/orders')
  revalidatePath(`/dashboard/orders/${orderId}`)
}

export async function addOrderNoteAction(orderId: string, note: string) {
  const { store, user } = await getDashboardContext()
  const text = note.trim()
  if (!text) return

  await db.insert(orderEvents).values({
    orderId,
    storeId: store.id,
    type: 'note',
    message: text,
    actorType: 'merchant',
    actorId: user.id,
  })

  revalidatePath(`/dashboard/orders/${orderId}`)
}

/** حذف طلب ناقص — التاجر شافه وقرّر إنه مش هيتابعه */
export async function dismissIncompleteAction(orderId: string) {
  const { store } = await getDashboardContext()

  await db
    .delete(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, store.id), eq(orders.isIncomplete, true)))

  revalidatePath('/dashboard/orders')
}
