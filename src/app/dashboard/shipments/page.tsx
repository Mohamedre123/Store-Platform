import { Truck } from 'lucide-react'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { formatMoney } from '@/lib/utils'
import { loadShipments } from '@/lib/shipments-data'
import { ShipmentsManager } from './shipments-manager'

export const metadata = { title: 'الشحنات' }

export default async function ShipmentsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'orders.view')

  /* الاستعلامات في `src/lib/shipments-data.ts` — تطبيق الموبايل بيقرا نفس البيانات */
  const { rows, pending, autoCarrierName, outstandingAmount, outstandingCount, inTransit, failed } =
    await loadShipments(store)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الشحنات"
        description="سجّل بوليصة كل طلب، تابع حالتها، وشوف فلوسك اللي لسه عند شركة الشحن."
      />

      <Reveal>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="في الطريق" value={String(inTransit)} hint="لسه ما اتسلّمتش" />
          <Stat
            label="فلوس عند شركة الشحن"
            value={formatMoney(outstandingAmount, store.currency)}
            hint={`${outstandingCount} شحنة اتسلّمت ولسه ما اتحصّلتش`}
            highlight={outstandingAmount > 0}
          />
          <Stat
            label="فشل أو رجع"
            value={String(failed)}
            hint={failed > 0 ? 'راجعها — دي خسارة شحن' : 'مافيش'}
          />
        </div>
      </Reveal>

      {rows.length === 0 && pending.length === 0 ? (
        <Reveal>
          <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Truck className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">مافيش شحنات لسه</h2>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              أول ما يبقى عندك طلب مؤكّد، هيظهر هنا عشان تسجّل بوليصته وتتابعها.
            </p>
          </Card>
        </Reveal>
      ) : (
        <Reveal>
          <ShipmentsManager
            shipments={rows}
            pending={pending}
            currency={store.currency}
            autoCarrier={autoCarrierName}
          />
        </Reveal>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string
  value: string
  hint: string
  highlight?: boolean
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs text-[var(--fg-muted)]">{label}</span>
      <span
        className="tabular text-xl font-bold"
        style={highlight ? { color: 'var(--color-warning)' } : undefined}
      >
        {value}
      </span>
      <span className="text-xs text-[var(--fg-subtle)]">{hint}</span>
    </Card>
  )
}
