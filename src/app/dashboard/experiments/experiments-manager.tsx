'use client'

import { useState, useTransition } from 'react'
import { FlaskConical, Plus, Trophy } from 'lucide-react'
import { Card } from '@/components/ui'
import { formatMoney } from '@/lib/utils'
import { MIN_VIEWS, readResult } from '@/lib/experiments-meta'
import {
  createExperimentAction,
  deleteExperimentAction,
  finishExperimentAction,
} from './actions'

export type ExperimentRow = {
  id: string
  name: string
  field: 'price' | 'title' | 'image' | 'description' | 'cta'
  targetId: string
  variantA: Record<string, unknown>
  variantB: Record<string, unknown>
  splitBps: number
  viewsA: number
  viewsB: number
  ordersA: number
  ordersB: number
  revenueA: number
  revenueB: number
  status: 'draft' | 'running' | 'paused' | 'finished'
  winner: 'a' | 'b' | null
  startedAt: Date | null
  productName: string | null
}

type ProductOption = { id: string; name: string; price: number }

export function ExperimentsManager({
  experiments,
  products,
  currency,
}: {
  experiments: ExperimentRow[]
  products: ProductOption[]
  currency: string
}) {
  const [adding, setAdding] = useState(false)

  const running = experiments.filter((e) => e.status === 'running')
  const done = experiments.filter((e) => e.status !== 'running')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-bold">
          شغّالة دلوقتي <span className="tabular font-normal text-[var(--fg-muted)]">({running.length})</span>
        </h2>
        <button
          type="button"
          onClick={() => setAdding((v) => !v)}
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-fg)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          تجربة جديدة
        </button>
      </div>

      {adding && (
        <NewExperiment products={products} currency={currency} onDone={() => setAdding(false)} />
      )}

      {running.length === 0 && !adding ? (
        <Card className="flex flex-col items-center gap-3 px-6 py-14 text-center">
          <FlaskConical className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
          <h3 className="font-semibold">مافيش تجارب شغّالة</h3>
          <p className="max-w-md text-sm text-[var(--fg-muted)]">
            جرّب سعرين على أكتر منتج بتبيعه. التوزيع بيفضل ثابت لكل زائر، والسعر
            اللي بيشوفه هو اللي بيدفعه.
          </p>
        </Card>
      ) : (
        running.map((e) => <ExperimentCard key={e.id} row={e} currency={currency} />)
      )}

      {done.length > 0 && (
        <>
          <h2 className="text-sm font-bold">
            خلصت <span className="tabular font-normal text-[var(--fg-muted)]">({done.length})</span>
          </h2>
          {done.map((e) => (
            <ExperimentCard key={e.id} row={e} currency={currency} />
          ))}
        </>
      )}
    </div>
  )
}

function ExperimentCard({ row: e, currency }: { row: ExperimentRow; currency: string }) {
  const [pending, start] = useTransition()
  const result = readResult(e)
  const isPrice = e.field === 'price'

  const label = (v: Record<string, unknown>) => {
    const value = v?.value
    if (isPrice && typeof value === 'number') return formatMoney(value, currency)
    return String(value ?? '—')
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">{e.name}</span>
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
              {isPrice ? 'السعر' : 'الاسم'}
            </span>
            {e.status === 'running' ? (
              <span className="rounded-md bg-[var(--color-info-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-info)]">
                شغّالة
              </span>
            ) : (
              <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
                خلصت
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--fg-muted)]">{e.productName ?? 'منتج محذوف'}</p>
        </div>

        {e.status === 'finished' && e.winner && (
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--color-success)]">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            فاز {e.winner === 'a' ? 'أ' : 'ب'}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Side
          tag="أ"
          value={label(e.variantA)}
          views={e.viewsA}
          orders={e.ordersA}
          revenue={e.revenueA}
          rpv={result.rpvA}
          cr={result.crA}
          winning={result.winner === 'a'}
          currency={currency}
        />
        <Side
          tag="ب"
          value={label(e.variantB)}
          views={e.viewsB}
          orders={e.ordersB}
          revenue={e.revenueB}
          rpv={result.rpvB}
          cr={result.crB}
          winning={result.winner === 'b'}
          currency={currency}
        />
      </div>

      {!result.enough ? (
        <p className="text-xs text-[var(--fg-subtle)]">
          محتاج {MIN_VIEWS} مشاهدة على الأقل لكل جانب قبل ما نقول مين أحسن — قبل
          كده الفرق ضجيج.
        </p>
      ) : result.winner ? (
        <p className="text-sm">
          النسخة <strong>{result.winner === 'a' ? 'أ' : 'ب'}</strong> بتكسب أكتر
          {result.lift !== null && (
            <>
              {' '}
              بـ<strong className="tabular">{result.lift}٪</strong> إيراد لكل مشاهدة
            </>
          )}
          .
        </p>
      ) : (
        <p className="text-sm text-[var(--fg-muted)]">النسختين متعادلتين تقريبًا.</p>
      )}

      {e.status === 'running' && (
        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            disabled={pending || !result.winner}
            onClick={() => start(() => finishExperimentAction(e.id, result.winner, true).then(() => {}))}
            className="min-h-10 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-fg)] disabled:opacity-50"
          >
            أوقفها وطبّق الفايز
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => finishExperimentAction(e.id, result.winner, false).then(() => {}))}
            className="min-h-10 rounded-lg border border-[var(--border-strong)] px-4 text-sm transition-colors hover:bg-[var(--surface-2)] disabled:opacity-60"
          >
            أوقفها من غير تغيير
          </button>
        </div>
      )}

      {e.status !== 'running' && (
        <div className="border-t border-[var(--border)] pt-3">
          <button
            type="button"
            disabled={pending}
            onClick={() => start(() => deleteExperimentAction(e.id).then(() => {}))}
            className="min-h-9 rounded-lg px-3 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--color-danger)] disabled:opacity-60"
          >
            حذف
          </button>
        </div>
      )}
    </Card>
  )
}

function Side({
  tag,
  value,
  views,
  orders,
  revenue,
  rpv,
  cr,
  winning,
  currency,
}: {
  tag: string
  value: string
  views: number
  orders: number
  revenue: number
  rpv: number
  cr: number
  winning: boolean
  currency: string
}) {
  return (
    <div
      className="rounded-lg border p-3"
      style={{
        borderColor: winning ? 'var(--color-success)' : 'var(--border)',
        background: winning ? 'var(--color-success-soft)' : 'transparent',
      }}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-[var(--fg-muted)]">نسخة {tag}</span>
        <span className="tabular font-bold">{value}</span>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <Metric label="مشاهدات" value={String(views)} />
        <Metric label="طلبات" value={String(orders)} />
        <Metric label="تحويل" value={`${cr.toFixed(1)}٪`} />
        <Metric label="إيراد" value={formatMoney(revenue, currency)} />
        <div className="col-span-2 mt-1 flex justify-between border-t border-[var(--border)] pt-1">
          <dt className="font-medium">إيراد لكل مشاهدة</dt>
          <dd className="tabular font-bold">{formatMoney(Math.round(rpv), currency)}</dd>
        </div>
      </dl>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <>
      <dt className="text-[var(--fg-subtle)]">{label}</dt>
      <dd className="tabular text-end font-medium">{value}</dd>
    </>
  )
}

function NewExperiment({
  products,
  currency,
  onDone,
}: {
  products: ProductOption[]
  currency: string
  onDone: () => void
}) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [productId, setProductId] = useState('')
  const [field, setField] = useState<'price' | 'title'>('price')
  const [valueA, setValueA] = useState('')
  const [valueB, setValueB] = useState('')

  const chosen = products.find((p) => p.id === productId)

  // النسخة أ بتبدأ بالقيمة الحالية: التجربة المفيدة بتقارن الجديد بالموجود
  const pick = (id: string) => {
    setProductId(id)
    const p = products.find((x) => x.id === id)
    if (!p) return
    setValueA(field === 'price' ? String(Math.round(p.price / 100)) : p.name)
    if (!name) setName(field === 'price' ? `سعر ${p.name}` : `اسم ${p.name}`)
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="المنتج">
          <select
            value={productId}
            onChange={(e) => pick(e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          >
            <option value="">اختار منتج…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} — {formatMoney(p.price, currency)}
              </option>
            ))}
          </select>
        </Field>

        <Field label="بتجرّب إيه">
          <select
            value={field}
            onChange={(e) => {
              const f = e.target.value as 'price' | 'title'
              setField(f)
              if (chosen) setValueA(f === 'price' ? String(Math.round(chosen.price / 100)) : chosen.name)
              setValueB('')
            }}
            className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          >
            <option value="price">السعر</option>
            <option value="title">اسم المنتج</option>
          </select>
        </Field>

        <Field label={field === 'price' ? 'النسخة أ — السعر الحالي (ج)' : 'النسخة أ — الاسم الحالي'}>
          <input
            value={valueA}
            onChange={(e) => setValueA(e.target.value)}
            inputMode={field === 'price' ? 'decimal' : 'text'}
            className="tabular h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </Field>

        <Field label={field === 'price' ? 'النسخة ب — السعر الجديد (ج)' : 'النسخة ب — الاسم الجديد'}>
          <input
            value={valueB}
            onChange={(e) => setValueB(e.target.value)}
            inputMode={field === 'price' ? 'decimal' : 'text'}
            placeholder={field === 'price' ? 'جرّب أعلى أو أقل' : 'صيغة تانية للاسم'}
            className="tabular h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </Field>

        <Field label="اسم التجربة">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
        </Field>
      </div>

      {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const res = await createExperimentAction({
                name,
                productId,
                field,
                valueA,
                valueB,
                splitPercent: 50,
              })
              if (res?.error) setError(res.error)
              else onDone()
            })
          }
          className="min-h-10 rounded-lg bg-[var(--primary)] px-5 text-sm font-medium text-[var(--primary-fg)] disabled:opacity-60"
        >
          {pending ? 'بتشتغل…' : 'شغّل التجربة'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-10 rounded-lg px-3 text-sm text-[var(--fg-muted)]"
        >
          إلغاء
        </button>
        <span className="text-xs text-[var(--fg-subtle)]">
          التقسيم ٥٠/٥٠، والسعر اللي الزائر يشوفه هو اللي هيدفعه.
        </span>
      </div>
    </Card>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--fg-muted)]">{label}</span>
      {children}
    </label>
  )
}
