import { Filter } from 'lucide-react'
import { Card } from '@/components/ui'

/**
 * قُمع التحويل.
 *
 * الرقم اللي بيهمّ في كل خطوة مش العدد، إنما **كام واحد وقع بينها
 * وبين اللي قبلها**. التاجر اللي شايف ٥٠٠ زائر و٥ طلبات مش عارف يعمل
 * إيه؛ اللي شايف إن ٤٠٠ ضافوا للسلة وواحد بس كمّل، عارف إن المشكلة
 * في الشيك أوت مش في المنتج.
 */
export function Funnel({
  data,
}: {
  data: {
    visitors: number
    productViews: number
    addToCarts: number
    checkoutsStarted: number
    orders: number
    dayCount: number
  }
}) {
  const steps = [
    { label: 'زوّار', value: data.visitors },
    { label: 'شافوا منتج', value: data.productViews },
    { label: 'ضافوا للسلة', value: data.addToCarts },
    { label: 'بدأوا الشيك أوت', value: data.checkoutsStarted },
    { label: 'أتمّوا الطلب', value: data.orders },
  ]

  const top = Math.max(1, steps[0].value)
  const overall = data.visitors > 0 ? (data.orders / data.visitors) * 100 : 0

  if (data.dayCount === 0) {
    return (
      <Card className="flex flex-col items-center gap-2 px-6 py-10 text-center">
        <Filter className="h-8 w-8 text-[var(--fg-subtle)]" aria-hidden="true" />
        <h2 className="font-semibold">القُمع لسه بيتجمّع</h2>
        <p className="max-w-md text-sm text-[var(--fg-muted)]">
          الزيارات بتتسجّل من دلوقتي، والتجميع بيتم مرة كل يوم — فأول قراءة
          هتبان بكرة. الطلبات فوق محسوبة لحظيًا زي ما هي.
        </p>
      </Card>
    )
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">قُمع التحويل</h2>
        <span className="text-sm text-[var(--fg-muted)]">
          معدّل التحويل{' '}
          <span className="tabular font-bold text-[var(--primary)]">{overall.toFixed(1)}٪</span>
        </span>
      </div>

      <ol className="flex flex-col gap-2.5">
        {steps.map((s, i) => {
          const prev = i === 0 ? null : steps[i - 1].value
          const drop = prev && prev > 0 ? Math.round(((prev - s.value) / prev) * 100) : null
          const width = Math.max(2, (s.value / top) * 100)

          return (
            <li key={s.label} className="flex flex-col gap-1">
              <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
                <span className="font-medium">{s.label}</span>
                <span className="flex items-baseline gap-2">
                  <span className="tabular font-bold">{s.value.toLocaleString('ar-EG')}</span>
                  {drop !== null && drop > 0 && (
                    <span className="tabular text-xs text-[var(--color-danger)]">
                      −{drop}٪
                    </span>
                  )}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                <div
                  className="h-full rounded-full bg-[var(--primary)]"
                  style={{ width: `${width}%` }}
                />
              </div>
            </li>
          )
        })}
      </ol>

      <p className="text-xs text-[var(--fg-subtle)]">
        من {data.dayCount} يوم فيهم نشاط. الزيارات بتتجمّع مرة كل يوم، فالنهاردة
        لسه ما دخلش.
      </p>
    </Card>
  )
}
