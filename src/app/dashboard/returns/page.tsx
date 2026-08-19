import { desc, eq } from 'drizzle-orm'
import { RotateCcw } from 'lucide-react'
import { db } from '@/db'
import { orders, returns } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { ReturnsManager, type ReturnRow } from './returns-manager'

export const metadata = { title: 'المرتجعات' }

export default async function ReturnsPage() {
  const { store } = await getDashboardContext()

  const rows = await db
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
    .limit(200)

  const open = rows.filter((r) => !['completed', 'rejected'].includes(r.status)).length

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
          <ReturnsManager returns={rows as ReturnRow[]} currency={store.currency} />
        </Reveal>
      )}
    </div>
  )
}
