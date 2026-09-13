import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orders, returns } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import type { ReturnRow } from '@/app/dashboard/returns/returns-manager'

/** بيانات صفحة المرتجعات — صفحة اللوحة و`/api/app/returns` بيقروا من هنا */
export async function loadReturns(store: ActiveStore) {
  const rows = (await db
    .select({
      id: returns.id,
      returnNumber: returns.returnNumber,
      type: returns.type,
      status: returns.status,
      reason: returns.reason,
      customerNote: returns.customerNote,
      merchantNote: returns.merchantNote,
      refundAmount: returns.refundAmount,
      createdAt: returns.createdAt,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
    })
    .from(returns)
    .innerJoin(orders, eq(orders.id, returns.orderId))
    .where(eq(returns.storeId, store.id))
    .orderBy(desc(returns.createdAt))
    .limit(200)) as ReturnRow[]

  return { rows, open: rows.filter((r) => !['completed', 'rejected'].includes(r.status)).length }
}
