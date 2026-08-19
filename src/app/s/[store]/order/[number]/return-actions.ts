'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { orderItems, orders, returnItems, returns, stores } from '@/db/schema'
import { getStore } from '@/lib/storefront'

const schema = z.object({
  storeIdentifier: z.string().min(1),
  orderNumber: z.coerce.number().int().positive(),
  token: z.string().min(1),
  type: z.enum(['refund', 'exchange']),
  reason: z.string().trim().min(2, 'اختار سبب الإرجاع').max(120),
  note: z.string().trim().max(500).optional(),
  items: z.array(z.object({ orderItemId: z.string().uuid(), quantity: z.number().int().min(1) })).min(1, 'اختار منتج واحد على الأقل'),
})

export type ReturnRequestState = { ok?: boolean; error?: string } | null

/**
 * طلب إرجاع من العميل.
 *
 * الوصول بالتوكن زي صفحة الطلب نفسها — رقم الطلب لوحده مش كفاية،
 * وإلا أي حد يجرّب أرقامًا ويطلب إرجاع طلبات مش بتاعته.
 *
 * المبلغ بيتحسب من أسعار الطلب المسجّلة لا من أي رقم جاي من المتصفح.
 */
export async function requestReturnAction(raw: unknown): Promise<ReturnRequestState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const store = await getStore(input.storeIdentifier)
  if (!store) return { error: 'المتجر مش موجود' }

  const [order] = await db
    .select({ id: orders.id, status: orders.status, deliveredAt: orders.deliveredAt })
    .from(orders)
    .where(
      and(
        eq(orders.storeId, store.id),
        eq(orders.orderNumber, input.orderNumber),
        eq(orders.recoveryToken, input.token),
      ),
    )
    .limit(1)

  if (!order) return { error: 'الطلب مش موجود' }

  // الإرجاع بعد التسليم بس — قبل كده الإلغاء هو الإجراء الصح
  if (order.status !== 'delivered') {
    return { error: 'الإرجاع متاح بعد ما الطلب يتسلّم. لو عايز تلغي، كلّم المتجر.' }
  }

  const [existing] = await db
    .select({ id: returns.id })
    .from(returns)
    .where(eq(returns.orderId, order.id))
    .limit(1)

  if (existing) return { error: 'فيه طلب إرجاع مسجّل على الطلب ده بالفعل' }

  // الأسعار من صفوف الطلب — مش من المتصفح
  const lines = await db
    .select({ id: orderItems.id, price: orderItems.price, quantity: orderItems.quantity })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))

  const byId = new Map(lines.map((l) => [l.id, l]))
  let refundAmount = 0
  const validItems: Array<{ orderItemId: string; quantity: number; amount: number }> = []

  for (const item of input.items) {
    const line = byId.get(item.orderItemId)
    if (!line) continue
    const qty = Math.min(item.quantity, line.quantity)
    const amount = line.price * qty
    refundAmount += amount
    validItems.push({ orderItemId: line.id, quantity: qty, amount })
  }

  if (validItems.length === 0) return { error: 'المنتجات المختارة مش في الطلب ده' }

  await db.transaction(async (tx) => {
    const [seq] = await tx
      .select({ n: sql<number>`coalesce(max(${returns.returnNumber}), 0) + 1` })
      .from(returns)
      .where(eq(returns.storeId, store.id))

    const [created] = await tx
      .insert(returns)
      .values({
        storeId: store.id,
        orderId: order.id,
        returnNumber: seq.n,
        type: input.type,
        status: 'requested',
        reason: input.reason,
        customerNote: input.note || null,
        refundAmount,
      })
      .returning({ id: returns.id })

    await tx.insert(returnItems).values(validItems.map((i) => ({ ...i, returnId: created.id })))
  })

  revalidatePath(`/s/${store.slug}/order/${input.orderNumber}`)
  return { ok: true }
}
