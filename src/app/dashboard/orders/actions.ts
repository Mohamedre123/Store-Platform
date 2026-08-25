'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orderEvents, orders } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { applyOrderStatus } from '@/lib/order-flow'
import type { OrderStatus } from '@/db/schema'

/**
 * تغيير حالة الطلب من اللوحة.
 *
 * المنطق نفسه في `@/lib/order-flow` مش هنا: نفس التحوّل بينادى من
 * ويب هوك بوابة الدفع وشركة الشحن، ودول مالهمش جلسة تاجر. الفعل ده
 * غلاف بيجيب السياق ويسلّم.
 */
export async function updateOrderStatusAction(orderId: string, status: OrderStatus) {
  const { store, user } = await getDashboardContext()

  await applyOrderStatus(store, orderId, status, { type: 'merchant', userId: user.id })

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

/**
 * تسجيل إن التاجر كلّم صاحب السلة المتروكة.
 *
 * من غير السطر ده، التاجر اللي بيراجع سلاته بعد يومين ما بيعرفش
 * كلّم مين — فيكلّم الواحد مرتين وتلاتة، والعميل يحسّها مطاردة
 * ويسيب المتجر خالص.
 */
export async function logRecoveryMessageAction(orderId: string, label: string) {
  const { store, user } = await getDashboardContext()

  const [order] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, store.id)))
    .limit(1)

  if (!order) return

  await db.insert(orderEvents).values({
    orderId,
    storeId: store.id,
    type: 'message_sent',
    message: `التاجر بعت رسالة استرداد: ${label}`,
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
