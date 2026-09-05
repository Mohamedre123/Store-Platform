'use client'

import { useState, useTransition } from 'react'
import { Plus, Timer, Trash2, X } from 'lucide-react'
import { deleteShippingMethodAction, saveShippingMethodAction } from './methods-actions'
import { Alert, Button, Card, Field, Input } from '@/components/ui'
import { Toggle } from '@/components/dashboard/controls'
import { toast } from '@/components/dashboard/toast'
import { cn, formatMoney, fromMinorUnits, toMinorUnits } from '@/lib/utils'

export type MethodRow = {
  id: string
  name: string
  hint: string | null
  priceDelta: number
  minDays: number | null
  maxDays: number | null
  enabled: boolean
  sortOrder: number
}

/**
 * طرق الشحن المتعددة.
 *
 * ## فرق سعر لا سعر كامل
 * التاجر سعّر محافظاته مرة. لو كل طريقة طلبت تسعيرة كاملة، «سريع»
 * معناها ٢٧ سطر تاني يتكتبوا بإيد — وأول تغيير في التعريفة يبقى
 * لازم يتعمل في مكانين.
 *
 * ## والفاضي مش معطّل
 * مفيش طرق = سعر واحد زي ما كان، ومفيش أي اختيار بيظهر للعميل.
 * الميزة بتتفتح لما التاجر يضيف أول طريقة.
 */
export function MethodsManager({
  rows,
  currency,
  /** سعر محافظة نموذجي — عشان المعاينة تبان برقم حقيقي */
  sampleBase,
}: {
  rows: MethodRow[]
  currency: string
  sampleBase: number
}) {
  const [editing, setEditing] = useState<MethodRow | 'new' | null>(null)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">طرق الشحن</h2>
        <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
          «عادي» و«سريع» و«استلام من الفرع» — كل واحدة بفرق سعرها ومدّتها، والعميل بيختار في
          الشيك أوت. الفرق بيتضاف على سعر المحافظة، فمش محتاج تسعّر المحافظات تاني.
        </p>
      </div>

      {rows.length === 0 && editing === null && (
        <Card className="flex flex-col items-center gap-2 px-5 py-8 text-center">
          <Timer className="h-7 w-7 text-[var(--fg-subtle)]" aria-hidden="true" />
          <p className="max-w-md text-sm leading-relaxed text-[var(--fg-muted)]">
            دلوقتي فيه سعر شحن واحد لكل محافظة، والعميل ما بيختارش. ضيف طريقة تانية لو بتقدّم
            توصيل سريع أو استلام من فرعك.
          </p>
        </Card>
      )}

      {rows.length > 0 && (
        <Card className="divide-y divide-[var(--border)]">
          {rows.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{r.name}</span>
                  {!r.enabled && (
                    <span className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-[11px] text-[var(--fg-muted)]">
                      موقوفة
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
                  {r.priceDelta === 0
                    ? 'بسعر المحافظة'
                    : r.priceDelta > 0
                      ? `+${formatMoney(r.priceDelta, currency)}`
                      : `−${formatMoney(Math.abs(r.priceDelta), currency)}`}
                  {r.minDays !== null || r.maxDays !== null
                    ? ` · ${daysLabel(r.minDays, r.maxDays)}`
                    : ''}
                  {r.hint ? ` · ${r.hint}` : ''}
                </span>
              </span>

              <span className="flex shrink-0 gap-2">
                <Button size="sm" variant="secondary" onClick={() => setEditing(r)}>
                  عدّل
                </Button>
                <DeleteButton id={r.id} name={r.name} />
              </span>
            </div>
          ))}
        </Card>
      )}

      {editing ? (
        <MethodForm
          row={editing === 'new' ? null : editing}
          currency={currency}
          sampleBase={sampleBase}
          nextOrder={rows.length}
          onDone={() => setEditing(null)}
        />
      ) : (
        <Button variant="secondary" onClick={() => setEditing('new')} className="self-start">
          <Plus className="h-4 w-4" aria-hidden="true" />
          ضيف طريقة
        </Button>
      )}
    </div>
  )
}

function daysLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return min === max ? `${min} يوم` : `${min}–${max} يوم`
  if (min !== null) return `من ${min} يوم`
  if (max !== null) return `لحد ${max} يوم`
  return ''
}

function MethodForm({
  row,
  currency,
  sampleBase,
  nextOrder,
  onDone,
}: {
  row: MethodRow | null
  currency: string
  sampleBase: number
  nextOrder: number
  onDone: () => void
}) {
  const [name, setName] = useState(row?.name ?? '')
  const [hint, setHint] = useState(row?.hint ?? '')
  /* الفرق بيتعرض بالجنيه وبيتخزّن بالقرش — والسالب مسموح */
  const [delta, setDelta] = useState(row ? String(fromMinorUnits(row.priceDelta)) : '')
  const [minDays, setMinDays] = useState(row?.minDays !== null && row ? String(row.minDays) : '')
  const [maxDays, setMaxDays] = useState(row?.maxDays !== null && row ? String(row.maxDays) : '')
  const [enabled, setEnabled] = useState(row?.enabled ?? true)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const deltaMinor = toMinorUnits(delta.replace(/[^\d.-]/g, '') || 0)
  const preview = Math.max(0, sampleBase + deltaMinor)

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">{row ? 'تعديل الطريقة' : 'طريقة جديدة'}</h3>
        <button
          type="button"
          onClick={onDone}
          aria-label="إغلاق"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="الاسم" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="توصيل سريع" />
        </Field>

        <Field label="سطر توضيحي" hint="بيظهر تحت الاسم في الشيك أوت.">
          <Input value={hint} onChange={(e) => setHint(e.target.value)} placeholder="يوصلك خلال ٢٤ ساعة" />
        </Field>
      </div>

      <Field
        label={`فرق السعر (${currency})`}
        hint="موجب للأغلى، وسالب للأرخص زي «استلام من الفرع». صفر يعني بسعر المحافظة."
      >
        <Input
          inputMode="decimal"
          value={delta}
          onChange={(e) => setDelta(e.target.value.replace(/[^\d.-]/g, ''))}
          className="tabular"
          placeholder="30"
        />
      </Field>

      <p className="rounded-lg bg-[var(--surface-2)] px-3.5 py-2.5 text-sm">
        محافظة شحنها{' '}
        <span className="tabular font-medium">{formatMoney(sampleBase, currency)}</span> هتبقى بالطريقة
        دي <span className="tabular font-bold">{formatMoney(preview, currency)}</span>
        {preview === 0 && deltaMinor < 0 && (
          <span className="mt-1 block text-xs text-[var(--fg-muted)]">
            الفرق أكبر من سعر المحافظة، فالشحن بيبقى مجاني — مش بالسالب.
          </span>
        )}
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="أقل عدد أيام" hint="سيبها فاضية عشان تاخد مدة المحافظة.">
          <Input
            inputMode="numeric"
            value={minDays}
            onChange={(e) => setMinDays(e.target.value.replace(/\D/g, ''))}
            className="tabular"
          />
        </Field>
        <Field label="أكتر عدد أيام">
          <Input
            inputMode="numeric"
            value={maxDays}
            onChange={(e) => setMaxDays(e.target.value.replace(/\D/g, ''))}
            className="tabular"
          />
        </Field>
      </div>

      <Toggle
        label="مفعّلة"
        hint="الموقوفة ما بتظهرش للعميل، وبتفضل محفوظة عندك."
        checked={enabled}
        onChange={setEnabled}
      />

      {error && <Alert tone="danger">{error}</Alert>}

      <div className="flex gap-2">
        <Button
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const res = await saveShippingMethodAction({
                id: row?.id,
                name,
                hint: hint || null,
                priceDelta: deltaMinor,
                minDays: minDays === '' ? null : Number(minDays),
                maxDays: maxDays === '' ? null : Number(maxDays),
                enabled,
                sortOrder: row?.sortOrder ?? nextOrder,
              })
              if (res?.error) setError(res.error)
              else {
                toast(row ? 'اتعدّلت' : 'اتضافت')
                onDone()
              }
            })
          }
        >
          {row ? 'احفظ' : 'ضيف'}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          إلغاء
        </Button>
      </div>
    </Card>
  )
}

function DeleteButton({ id, name }: { id: string; name: string }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  if (confirming) {
    return (
      <span className="flex items-center gap-1">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await deleteShippingMethodAction(id)
              toast('اتحذفت')
            })
          }
          className="h-9 rounded-lg bg-[var(--color-danger)] px-3 text-xs font-semibold text-white disabled:opacity-60"
        >
          أكيد؟
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          aria-label="إلغاء"
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-strong)]',
            'text-[var(--fg-muted)]',
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </span>
    )
  }

  return (
    <Button size="sm" variant="ghost" aria-label={`احذف ${name}`} onClick={() => setConfirming(true)}>
      <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
    </Button>
  )
}
