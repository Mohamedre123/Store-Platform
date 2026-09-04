import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { expenses, orders } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { computeProfit } from '@/lib/expenses'
import { formatBps, formatMoney } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { ExpensesManager, type CategoryTotal, type ExpenseRow } from './expenses-manager'

export const metadata = { title: 'المصروفات' }

/** طلب حقيقي محسوب في الإيراد — نفس تعريف صفحة التحليلات بالحرف */
const realOrder = sql`is_incomplete = false and status not in ('cancelled','returned')`

export default async function ExpensesPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'finance.view')

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
      .where(eq(expenses.storeId, store.id))
      .orderBy(desc(expenses.spentAt))
      .limit(200),

    /* التوزيع على آخر ٣٠ يوم — نفس نافذة مؤشرات التحليلات */
    db
      .select({ category: expenses.category, total: sql<number>`sum(${expenses.amount})::bigint` })
      .from(expenses)
      .where(
        and(
          eq(expenses.storeId, store.id),
          sql`${expenses.spentAt} >= now() - interval '30 days'`,
        ),
      )
      .groupBy(expenses.category)
      .orderBy(sql`sum(${expenses.amount}) desc`),

    db
      .select({
        revenue: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`,
        cogs: sql<number>`coalesce(sum(${orders.costTotal}), 0)::bigint`,
        shipping: sql<number>`coalesce(sum(${orders.shippingTotal}), 0)::bigint`,
      })
      .from(orders)
      .where(
        and(
          eq(orders.storeId, store.id),
          realOrder,
          sql`${orders.createdAt} >= now() - interval '30 days'`,
        ),
      ),

    db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint` })
      .from(expenses)
      .where(
        and(
          eq(expenses.storeId, store.id),
          sql`${expenses.spentAt} >= now() - interval '30 days'`,
        ),
      ),
  ])

  const profit = computeProfit({
    revenue: Number(sales?.revenue ?? 0),
    cogs: Number(sales?.cogs ?? 0),
    shippingCollected: Number(sales?.shipping ?? 0),
    expenses: Number(monthSpend?.total ?? 0),
  })

  const cards = [
    { label: 'مبيعات ٣٠ يوم', value: formatMoney(profit.revenue, store.currency) },
    { label: 'تكلفة البضاعة', value: `− ${formatMoney(profit.cogs, store.currency)}` },
    { label: 'مصروفات', value: `− ${formatMoney(profit.expenses, store.currency)}` },
    {
      label: 'صافي الربح',
      value: formatMoney(profit.net, store.currency),
      strong: true,
      hint: profit.net !== 0 ? `هامش ${formatBps(profit.marginBps)}` : undefined,
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المصروفات"
        description="الإعلانات والإيجار والمرتبات — البنود اللي بتاكل الربح وما بتبانش في أي طلب."
      />

      <Reveal>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label} className="flex flex-col gap-1 p-4">
              <span className="text-xs text-[var(--fg-muted)]">{c.label}</span>
              <span
                className={
                  c.strong
                    ? `tabular text-xl font-bold ${profit.net < 0 ? 'text-[var(--color-danger)]' : ''}`
                    : 'tabular text-lg font-semibold'
                }
              >
                {c.value}
              </span>
              {c.hint && <span className="text-xs text-[var(--fg-subtle)]">{c.hint}</span>}
            </Card>
          ))}
        </div>
      </Reveal>

      {/*
        الشحن مشروح تحت الأرقام لا جوّاها.

        اللي التاجر حصّله شحن بيدفعه لشركة الشحن، فمحسوبش لا ربح ولا
        خسارة هنا. من غير السطر ده، التاجر بيجمع الشحن على مبيعاته
        ويفتكر ربحه أعلى مما هو.
      */}
      {profit.shippingCollected > 0 && (
        <Reveal delay={40}>
          <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
            الشحن المحصَّل ({formatMoney(profit.shippingCollected, store.currency)}) متشال من
            الحساب — لأنه بيروح لشركة الشحن. سجّل فاتورة الشحن في المصروفات وهتشوف الفرق الحقيقي
            بين اللي حصّلته واللي دفعته.
          </p>
        </Reveal>
      )}

      <Reveal delay={80}>
        <ExpensesManager
          rows={rows.map(
            (r): ExpenseRow => ({
              id: r.id,
              title: r.title,
              category: r.category,
              amount: r.amount,
              spentAt: r.spentAt.toISOString(),
              note: r.note,
              isRecurring: r.isRecurring,
            }),
          )}
          totals={totals.map((t): CategoryTotal => ({ category: t.category, total: Number(t.total) }))}
          monthTotal={Number(monthSpend?.total ?? 0)}
          currency={store.currency}
        />
      </Reveal>
    </div>
  )
}
