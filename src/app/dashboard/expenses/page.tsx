import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadExpenses } from '@/lib/expenses-data'
import { formatBps, formatMoney } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { ExpensesManager } from './expenses-manager'

export const metadata = { title: 'المصروفات' }

export default async function ExpensesPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'finance.view')

  const { rows, totals, monthTotal, profit } = await loadExpenses(store.id)

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
        <ExpensesManager rows={rows} totals={totals} monthTotal={monthTotal} currency={store.currency} />
      </Reveal>
    </div>
  )
}
