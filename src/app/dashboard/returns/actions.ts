'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { inventoryMovements, orderEvents, orderItems, products, returnItems, returns } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import type { ReturnStatus } from '@/lib/returns-meta'

export type ReturnState = { ok?: boolean; error?: string } | null

/**
 * تغيير حالة طلب الإرجاع.
 *
 * لما الحالة توصل «اكتمل»، الكميات بترجع للمخزون مرة واحدة بس —
 * والحركة بتتسجّل. الترجيع مربوط بالاكتمال مش بالموافقة، لأن المنتج
 * ساعتها بيبقى فعلًا رجع للمخزن ومتفحوص.
 */
export async function updateReturnStatusAction(id: string, status: ReturnStatus): Promise<ReturnState> {
  const { store, user } = await getDashboardContext()

  const [ret] = await db
    .select({
      id: returns.id,
      orderId: returns.orderId,
      status: returns.status,
      returnNumber: returns.returnNumber,
      restockItems: returns.restockItems,
    })
    .from(returns)
    .where(and(eq(returns.id, id), eq(returns.storeId, store.id)))
    .limit(1)

  if (!ret) return { error: 'طلب الإرجاع مش موجود' }
  if (ret.status === status) return { ok: true }

  const completing = status === 'completed' && ret.status !== 'completed'

  await db.transaction(async (tx) => {
    await tx.update(returns).set({ status }).where(eq(returns.id, id))

    if (completing && ret.restockItems) {
      const items = await tx
        .select({
          productId: orderItems.productId,
          quantity: returnItems.quantity,
        })
        .from(returnItems)
        .innerJoin(orderItems, eq(orderItems.id, returnItems.orderItemId))
        .where(eq(returnItems.returnId, id))

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
          reason: 'return',
          referenceId: id,
          note: `مرتجع رقم ${ret.returnNumber}`,
          createdBy: user.id,
        })
      }
    }

    await tx.insert(orderEvents).values({
      orderId: ret.orderId,
      storeId: store.id,
      type: 'status_changed',
      message: `المرتجع #${ret.returnNumber}: ${status}`,
      actorType: 'merchant',
      actorId: user.id,
    })
  })

  revalidatePath('/dashboard/returns')
  return { ok: true }
}

export async function setReturnNoteAction(id: string, note: string): Promise<ReturnState> {
  const { store } = await getDashboardContext()

  const updated = await db
    .update(returns)
    .set({ merchantNote: note.trim() || null })
    .where(and(eq(returns.id, id), eq(returns.storeId, store.id)))
    .returning({ id: returns.id })

  if (!updated.length) return { error: 'طلب الإرجاع مش موجود' }

  revalidatePath('/dashboard/returns')
  return { ok: true }
}
