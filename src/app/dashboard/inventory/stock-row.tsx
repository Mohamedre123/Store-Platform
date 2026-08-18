'use client'

import { useState, useTransition } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { setLowStockThresholdAction, setStockAction } from './actions'

/**
 * خانة مخزون بتحفظ لوحدها.
 *
 * التاجر بيعدّل ١٠ منتجات ورا بعض، فزرار «حفظ» لكل واحد بيقطع إيقاعه.
 * الحفظ بيحصل لما يسيب الخانة أو يدوس Enter، والقيمة بترجع لأصلها لو
 * الحفظ فشل — عشان ما يفتكرش إنه حفظ وهو ما حفظش.
 */
export function StockCell({
  kind,
  id,
  stock,
  threshold,
  compact,
}: {
  kind: 'product' | 'variant'
  id: string
  stock: number
  threshold: number
  compact?: boolean
}) {
  const [value, setValue] = useState(String(stock))
  const [saved, setSaved] = useState(stock)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()
  const [justSaved, setJustSaved] = useState(false)

  function commit() {
    const next = Number(value)
    if (!Number.isFinite(next) || next < 0) {
      setValue(String(saved))
      setError(null)
      return
    }
    if (next === saved) return

    start(async () => {
      const res = await setStockAction({ kind, id, stock: next })
      if (res?.error) {
        setError(res.error)
        setValue(String(saved))
        return
      }
      setError(null)
      setSaved(next)
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1600)
    })
  }

  const current = Number(value)
  const out = saved <= 0
  const low = !out && saved <= threshold

  const tone = out
    ? 'border-[var(--color-danger)] text-[var(--color-danger)]'
    : low
      ? 'border-[var(--color-warning)] text-[var(--color-warning)]'
      : 'border-[var(--border-strong)]'

  return (
    <div className="flex items-center gap-2">
      {(out || low) && !pending && (
        <AlertTriangle
          className={`h-4 w-4 shrink-0 ${out ? 'text-[var(--color-danger)]' : 'text-[var(--color-warning)]'}`}
          aria-label={out ? 'نافد' : 'مخزون منخفض'}
        />
      )}
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur()
          if (e.key === 'Escape') setValue(String(saved))
        }}
        disabled={pending}
        inputMode="numeric"
        dir="ltr"
        aria-label="الكمية المتاحة"
        aria-invalid={Number.isFinite(current) ? undefined : true}
        className={`h-9 rounded-md border bg-[var(--surface)] px-2 text-start text-sm tabular-nums transition-colors focus:border-[var(--primary)] focus:outline-none disabled:opacity-60 ${tone} ${compact ? 'w-16' : 'w-20'}`}
      />
      <span className="w-4 shrink-0">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-[var(--fg-subtle)]" aria-label="بيحفظ" />
        ) : justSaved ? (
          <Check className="h-4 w-4 text-[var(--color-success)]" aria-label="اتحفظ" />
        ) : null}
      </span>
      {error && <span className="text-xs text-[var(--color-danger)]">{error}</span>}
    </div>
  )
}

/** حد التنبيه — بيحفظ بنفس إيقاع خانة المخزون */
export function ThresholdCell({ productId, threshold }: { productId: string; threshold: number }) {
  const [value, setValue] = useState(String(threshold))
  const [saved, setSaved] = useState(threshold)
  const [pending, start] = useTransition()

  function commit() {
    const next = Number(value)
    if (!Number.isFinite(next) || next < 0) {
      setValue(String(saved))
      return
    }
    if (next === saved) return

    start(async () => {
      const res = await setLowStockThresholdAction(productId, next)
      if (res?.error) {
        setValue(String(saved))
        return
      }
      setSaved(next)
    })
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') setValue(String(saved))
      }}
      disabled={pending}
      inputMode="numeric"
      dir="ltr"
      aria-label="نبّهني لما الكمية توصل لـ"
      className="h-9 w-16 rounded-md border border-[var(--border)] bg-transparent px-2 text-start text-sm tabular-nums text-[var(--fg-muted)] transition-colors focus:border-[var(--primary)] focus:outline-none disabled:opacity-60"
    />
  )
}
