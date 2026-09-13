import { RotateCcw } from 'lucide-react'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadReturns } from '@/lib/returns-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { ReturnsManager } from './returns-manager'

export const metadata = { title: 'المرتجعات' }

export default async function ReturnsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'orders.view')

  /* الاستعلام في `src/lib/returns-data.ts` — تطبيق الموبايل بيقرا نفس البيانات */
  const { rows, open } = await loadReturns(store)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المرتجعات"
        description={
          open > 0
            ? `${open} طلب إرجاع محتاج إجراء منك.`
            : 'طلبات الإرجاع والاستبدال من عملائك.'
        }
      />

      {rows.length === 0 ? (
        <Reveal>
          <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <RotateCcw className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">مافيش مرتجعات</h2>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              العميل بيقدر يطلب إرجاع من صفحة طلبه بعد ما يتسلّم.
            </p>
          </Card>
        </Reveal>
      ) : (
        <Reveal>
          <ReturnsManager returns={rows} currency={store.currency} />
        </Reveal>
      )}
    </div>
  )
}
