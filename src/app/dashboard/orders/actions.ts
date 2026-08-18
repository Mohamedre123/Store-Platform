'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { inventoryMovements, orderEvents, orderItems, orders, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
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
    .select({ id: orders.id, status: orders.status, orderNumber: orders.orderNumber })
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
