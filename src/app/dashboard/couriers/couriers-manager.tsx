'use client'

import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import {
  Bike,
  Check,
  Copy,
  Link2,
  Pencil,
  Plus,
  RefreshCw,
  Truck,
  Wallet,
  X,
} from 'lucide-react'
import {
  assignCourierAction,
  rotateCourierTokenAction,
  saveCourierAction,
  settleCourierAction,
  toggleCourierAction,
} from './actions'
import { VEHICLES, vehicleLabel, type CourierRow, type VehicleKey } from '@/lib/couriers-meta'
import { Alert, Button, Card, Field, Input, Textarea } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { cn, formatMoney } from '@/lib/utils'

export type UnassignedOrder = {
  id: string
  orderNumber: number
  customerName: string | null
  total: number
  isPaid: boolean
  city: string | null
  createdAt: string
}

/**
 * شاشة المندوبين.
 *
 * ## الشاشة دي بتجاوب على سؤالين، والاتنين بيتسألوا كل يوم
 * ١. **مين هيخرج بإيه؟** — الطلبات المستنية فوق، وكل واحد بيتسند
 *    بضغطة. الترتيب ده مقصود: الإسناد هو الشغل اليومي، وقايمة
 *    المندوبين مرجع بيتفتح مرة في الشهر.
 * ٢. **مين معاه كام؟** — الفلوس اللي المندوب حصّلها وما سلّمهاش
 *    ظاهرة جنب اسمه بالقرش. ده الرقم اللي التاجر بيحسبه على ورقة
 *    كل ليلة، وأول غلطة فيه بتكلّفه يوم بيعه.
 */
export function CouriersManager({
  rows,
  cities,
  currency,
  origin,
  waiting,
}: {
  rows: CourierRow[]
  cities: string[]
  currency: string
  origin: string
  waiting: UnassignedOrder[]
}) {
  const [editing, setEditing] = useState<CourierRow | 'new' | null>(null)

  const active = useMemo(() => rows.filter((r) => r.isActive), [rows])
  const totalDue = rows.reduce((s, r) => s + r.dueAmount, 0)

  return (
    <div className="flex flex-col gap-8">
      {rows.length > 0 && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="مندوبين شغّالين" value={String(active.length)} />
          <Stat label="طلبات في الطريق" value={String(rows.reduce((s, r) => s + r.openCount, 0))} />
          <Stat label="مستنية إسناد" value={String(waiting.length)} />
          <Stat
            label="فلوس مع المندوبين"
            value={formatMoney(totalDue, currency)}
            strong={totalDue > 0}
          />
        </div>
      )}

      {/* ────────── الطلبات المستنية ────────── */}
      {active.length > 0 && waiting.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-[var(--color-warning)]" aria-hidden="true" />
            <h2 className="text-sm font-semibold">طلبات مؤكّدة مستنية مندوب ({waiting.length})</h2>
          </div>
          <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
            دول العملاء اللي دفعوا أو أكّدوا ولسه محدّش ماشي بطلبهم. كل يوم بيعدّي عليهم بيزوّد
            احتمال إنهم يلغوا.
          </p>
          <Card className="divide-y divide-[var(--border)]">
            {waiting.map((o) => (
              <WaitingRow key={o.id} order={o} couriers={active} currency={currency} />
            ))}
          </Card>
        </section>
      )}

      {/* ────────── المندوبون ────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">المندوبون</h2>
          {editing !== 'new' && (
            <Button size="sm" onClick={() => setEditing('new')}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              ضيف مندوب
            </Button>
          )}
        </div>

        {editing === 'new' && (
          <CourierForm cities={cities} currency={currency} onDone={() => setEditing(null)} />
        )}

        {rows.length === 0 && editing !== 'new' ? (
          <Card className="flex flex-col items-center gap-2 px-6 py-14 text-center">
            <Bike className="h-8 w-8 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h3 className="text-lg font-semibold">مفيش مندوبين لسه</h3>
            <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
              لو بتوصّل بمندوبك أنت — مش بشركة شحن — سجّله هنا. هتسنده الطلبات بضغطة، وهو هيشوفها
              على موبايله برابط من غير حساب ولا باسورد، وحسابه هيتقفل من نفس الشاشة.
            </p>
          </Card>
        ) : (
          rows.map((c) =>
            editing !== 'new' && typeof editing === 'object' && editing?.id === c.id ? (
              <CourierForm
                key={c.id}
                courier={c}
                cities={cities}
                currency={currency}
                onDone={() => setEditing(null)}
              />
            ) : (
              <CourierCard
                key={c.id}
                courier={c}
                currency={currency}
                origin={origin}
                onEdit={() => setEditing(c)}
              />
            ),
          )
        )}
      </section>
    </div>
  )
}

function Stat({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs text-[var(--fg-muted)]">{label}</span>
      <span className={cn('tabular text-lg font-semibold', strong && 'text-[var(--color-warning)]')}>
        {value}
      </span>
    </Card>
  )
}

/* ────────────────────────── صف طلب مستني ────────────────────────── */

function WaitingRow({
  order,
  couriers,
  currency,
}: {
  order: UnassignedOrder
  couriers: CourierRow[]
  currency: string
}) {
  const [pending, start] = useTransition()

  /*
    المندوبين اللي بيغطّوا مدينة الطلب بيطلعوا الأول.

    التاجر عنده خمس مندوبين وكل واحد على منطقة — واختيار الغلط
    معناه توصيلة بتلفّ نص القاهرة. واللي مالوش مناطق محدّدة بيفضل
    ظاهرًا: أول مندوب بيتسجّل غالبًا بلا مناطق، وإخفاؤه كان هيخلّي
    القايمة تطلع فاضية.
  */
  const sorted = useMemo(() => {
    if (!order.city) return couriers
    const covers = (c: CourierRow) => c.zones.length === 0 || c.zones.includes(order.city!)
    return [...couriers].sort((a, b) => Number(covers(b)) - Number(covers(a)))
  }, [couriers, order.city])

  function assign(courierId: string) {
    if (!courierId) return
    start(async () => {
      const res = await assignCourierAction(order.id, courierId)
      if (res?.error) toast(res.error, 'error')
      else toast(`الطلب #${order.orderNumber} اتسند`)
    })
  }

  return (
    <div className="flex flex-wrap items-center gap-3 p-4">
      <Link
        href={`/dashboard/orders/${order.id}`}
        className="tabular shrink-0 text-sm font-semibold hover:underline"
      >
        #{order.orderNumber}
      </Link>

      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{order.customerName || 'بلا اسم'}</span>
        {order.city && (
          <span className="block truncate text-xs text-[var(--fg-subtle)]">{order.city}</span>
        )}
      </span>

      <span className="tabular shrink-0 text-xs text-[var(--fg-muted)]">
        {order.isPaid ? 'مدفوع' : formatMoney(order.total, currency)}
      </span>

      <select
        className="h-9 shrink-0 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm"
        defaultValue=""
        disabled={pending}
        onChange={(e) => assign(e.target.value)}
        aria-label={`اسند الطلب ${order.orderNumber} لمندوب`}
      >
        <option value="">اسند لمندوب…</option>
        {sorted.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
            {order.city && c.zones.includes(order.city) ? ' ✓' : ''}
          </option>
        ))}
      </select>
    </div>
  )
}

/* ────────────────────────── كارت مندوب ────────────────────────── */

function CourierCard({
  courier,
  currency,
  origin,
  onEdit,
}: {
  courier: CourierRow
  currency: string
  origin: string
  onEdit: () => void
}) {
  const [pending, start] = useTransition()
  const [copied, setCopied] = useState(false)
  const link = `${origin}/mandoub/${courier.accessToken}`

  function copyLink() {
    navigator.clipboard.writeText(link).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        toast('الرابط اتنسخ — ابعتهوله على واتساب')
      },
      () => toast('المتصفح رفض النسخ — اختار الرابط بإيدك', 'error'),
    )
  }

  return (
    <Card className={cn('flex flex-col gap-4 p-4', !courier.isActive && 'opacity-60')}>
      <div className="flex flex-wrap items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
          <Bike className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-semibold">{courier.name}</h3>
            {!courier.isActive && (
              <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]">
                متوقّف
              </span>
            )}
          </div>
          <p dir="ltr" className="text-start text-xs text-[var(--fg-subtle)]">
            {courier.phone} · {vehicleLabel(courier.vehicle)}
          </p>
          {courier.zones.length > 0 && (
            <p className="mt-1 truncate text-xs text-[var(--fg-subtle)]">
              {courier.zones.join('، ')}
            </p>
          )}
        </div>

        <div className="flex shrink-0 gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`عدّل ${courier.name}`}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await toggleCourierAction(courier.id, !courier.isActive)
                if (res?.error) toast(res.error, 'error')
                else toast(courier.isActive ? 'المندوب اتوقّف' : 'المندوب رجع شغّال')
              })
            }
          >
            {courier.isActive ? 'وقّفه' : 'شغّله'}
          </Button>
        </div>
      </div>

      {/* أرقامه */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <MiniStat label="في الطريق" value={String(courier.openCount)} />
        <MiniStat label="وصّل" value={String(courier.deliveredCount)} />
        <MiniStat label="فشل / رجع" value={String(courier.failedCount)} danger={courier.failedCount > 0} />
        <MiniStat
          label="معاه فلوس"
          value={formatMoney(courier.dueAmount, currency)}
          warn={courier.dueAmount > 0}
        />
      </div>

      {/* رابطه */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-[var(--surface-2)] p-2">
        <Link2 className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
        <code dir="ltr" className="min-w-0 flex-1 truncate text-start text-[11px] text-[var(--fg-muted)]">
          {link}
        </code>
        <Button size="sm" variant="secondary" onClick={copyLink}>
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          انسخ
        </Button>
        <Button
          size="sm"
          variant="ghost"
          loading={pending}
          onClick={() => {
            if (!confirm('الرابط القديم هيموت فورًا والمندوب مش هيشوف حاجة لحد ما تبعتله الجديد. تمام؟')) return
            start(async () => {
              const res = await rotateCourierTokenAction(courier.id)
              if (res?.error) toast(res.error, 'error')
              else toast('رابط جديد اتعمل — ابعتهوله')
            })
          }}
          aria-label="رابط جديد"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {/* التسوية */}
      {(courier.dueAmount > 0 || courier.feesDue > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3">
          <div className="min-w-0 text-xs leading-relaxed text-[var(--fg-muted)]">
            هياخد منك <strong className="tabular">{formatMoney(courier.feesDue, currency)}</strong> أجرة،
            وهيسلّمك <strong className="tabular">{formatMoney(courier.dueAmount, currency)}</strong> تحصيل.
            {courier.dueAmount > courier.feesDue && (
              <>
                {' '}الصافي ليك{' '}
                <strong className="tabular">
                  {formatMoney(courier.dueAmount - courier.feesDue, currency)}
                </strong>
                .
              </>
            )}
          </div>
          <Button
            size="sm"
            variant="secondary"
            loading={pending}
            onClick={() => {
              if (!confirm('هتقفل حساب المندوب على الأرقام دي. مش هينفع ترجع فيها.')) return
              start(async () => {
                const res = await settleCourierAction(courier.id)
                if (res?.error) toast(res.error, 'error')
                else toast(`الحساب اتقفل على ${res.count ?? 0} شحنة`)
              })
            }}
          >
            <Wallet className="h-4 w-4" aria-hidden="true" />
            اقفل الحساب
          </Button>
        </div>
      )}

      {courier.note && (
        <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">{courier.note}</p>
      )}
    </Card>
  )
}

function MiniStat({
  label,
  value,
  warn,
  danger,
}: {
  label: string
  value: string
  warn?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg bg-[var(--surface-2)] px-3 py-2">
      <span className="text-[11px] text-[var(--fg-subtle)]">{label}</span>
      <span
        className={cn(
          'tabular text-sm font-semibold',
          warn && 'text-[var(--color-warning)]',
          danger && 'text-[var(--color-danger)]',
        )}
      >
        {value}
      </span>
    </div>
  )
}

/* ────────────────────────── الفورم ────────────────────────── */

function CourierForm({
  courier,
  cities,
  currency,
  onDone,
}: {
  courier?: CourierRow
  cities: string[]
  currency: string
  onDone: () => void
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [zones, setZones] = useState<string[]>(courier?.zones ?? [])
  const [vehicle, setVehicle] = useState<VehicleKey>(courier?.vehicle ?? 'motorcycle')

  function toggleZone(city: string) {
    setZones((z) => (z.includes(city) ? z.filter((c) => c !== city) : [...z, city]))
  }

  return (
    <Card className="flex flex-col gap-4 p-4">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          setError(null)
          const fd = new FormData(e.currentTarget)
          /* الأجرة بتتكتب بالجنيه وبتتخزّن بالقرش — زي كل مبالغ المنصة */
          const fee = Math.round(Number(fd.get('fee') || 0) * 100)

          start(async () => {
            const res = await saveCourierAction({
              id: courier?.id,
              name: fd.get('name'),
              phone: fd.get('phone'),
              vehicle,
              zones,
              feePerOrder: Number.isFinite(fee) && fee >= 0 ? fee : 0,
              note: fd.get('note'),
            })
            if (res?.error) setError(res.error)
            else {
              toast(courier ? 'بيانات المندوب اتحفظت' : 'المندوب اتضاف')
              onDone()
            }
          })
        }}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="الاسم" required htmlFor="c-name">
            <Input id="c-name" name="name" defaultValue={courier?.name} required maxLength={80} />
          </Field>

          <Field label="الموبايل" required htmlFor="c-phone" hint="هيتبعتله الرابط عليه">
            <Input
              id="c-phone"
              name="phone"
              type="tel"
              dir="ltr"
              defaultValue={courier?.phone}
              required
              maxLength={24}
            />
          </Field>

          <Field label="بيتنقّل بإيه">
            <div className="flex flex-wrap gap-2">
              {VEHICLES.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setVehicle(v.key)}
                  className={cn(
                    'h-9 rounded-lg border px-3 text-sm transition-colors',
                    vehicle === v.key
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </Field>

          <Field
            label="أجرته على الطلب"
            htmlFor="c-fee"
            hint="مبلغ ثابت بالجنيه — بيتحسب في قفل حسابه"
          >
            <Input
              id="c-fee"
              name="fee"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              defaultValue={courier ? courier.feePerOrder / 100 : ''}
              placeholder="30"
            />
          </Field>
        </div>

        {cities.length > 0 && (
          <Field
            label="المناطق اللي بيغطّيها"
            hint="اختياري — لو سِبتها فاضية هيبان في كل الطلبات. لو حدّدتها، الطلب اللي في منطقته هيرشّحه لك."
          >
            <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-[var(--border)] p-2">
              {cities.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleZone(c)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs transition-colors',
                    zones.includes(c)
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'border-[var(--border-strong)] text-[var(--fg-muted)]',
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
          </Field>
        )}

        <Field label="ملاحظة" htmlFor="c-note">
          <Textarea id="c-note" name="note" rows={2} defaultValue={courier?.note ?? ''} maxLength={400} />
        </Field>

        {error && <Alert tone="danger">{error}</Alert>}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            {courier ? 'احفظ' : 'ضيف المندوب'}
          </Button>
          <Button type="button" variant="ghost" onClick={onDone}>
            <X className="h-4 w-4" aria-hidden="true" />
            إلغاء
          </Button>
        </div>
      </form>
    </Card>
  )
}
