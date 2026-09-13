import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { expenses, orders } from '@/db/schema'
import { computeProfit } from '@/lib/expenses'

/** طلب حقيقي محسوب في الإيراد — نفس تعريف صفحة التحليلات بالحرف */
const realOrder = sql`is_incomplete = false and status not in ('cancelled','returned')`

/**
 * بيانات شاشة المصروفات — صفحة اللوحة (`/dashboard/expenses`) وتطبيق
 * الموبايل (`/api/app/expenses`) الاتنين بيقروا من هنا، فالربح رقم واحد.
 */
export async function loadExpenses(storeId: string) {
  const [rows, totals, [sales], [monthSpend]] = await Promise.all([
    db
      .select({
        id: expenses.id,
        title: expenses.title,
        category: expenses.category,
        amount: expenses.amount,
        spentAt: expenses.spentAt,
        note: expenses.note,
        isRecurring: expenses.isRecurring,
      })
      .from(expenses)
      .where(eq(expenses.storeId, storeId))
      .orderBy(desc(expenses.spentAt))
      .limit(200),

    /* التوزيع على آخر ٣٠ يوم — نفس نافذة مؤشرات التحليلات */
    db
      .select({ category: expenses.category, total: sql<number>`sum(${expenses.amount})::bigint` })
      .from(expenses)
      .where(and(eq(expenses.storeId, storeId), sql`${expenses.spentAt} >= now() - interval '30 days'`))
      .groupBy(expenses.category)
      .orderBy(sql`sum(${expenses.amount}) desc`),

    db
      .select({
        revenue: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`,
        cogs: sql<number>`coalesce(sum(${orders.costTotal}), 0)::bigint`,
        shipping: sql<number>`coalesce(sum(${orders.shippingTotal}), 0)::bigint`,
      })
      .from(orders)
      .where(and(eq(orders.storeId, storeId), realOrder, sql`${orders.createdAt} >= now() - interval '30 days'`)),

    db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint` })
      .from(expenses)
      .where(and(eq(expenses.storeId, storeId), sql`${expenses.spentAt} >= now() - interval '30 days'`)),
  ])

  const monthTotal = Number(monthSpend?.total ?? 0)
  const profit = computeProfit({
    revenue: Number(sales?.revenue ?? 0),
    cogs: Number(sales?.cogs ?? 0),
    shippingCollected: Number(sales?.shipping ?? 0),
    expenses: monthTotal,
  })

  return {
    rows: rows.map((r) => ({
      id: r.id,
      title: r.title,
      category: r.category,
      amount: r.amount,
      spentAt: r.spentAt.toISOString(),
      note: r.note,
      isRecurring: r.isRecurring,
    })),
    totals: totals.map((t) => ({ category: t.category, total: Number(t.total) })),
    monthTotal,
    profit,
  }
}
