'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { RotateCcw } from 'lucide-react'
import { requestReturnAction } from './return-actions'
import { RETURN_REASONS } from '@/lib/returns-meta'
import { formatMoney } from '@/lib/utils'

type Item = { id: string; name: string; quantity: number; price: number }

/**
 * طلب إرجاع من صفحة الطلب.
 *
 * مقفول افتراضيًا: أغلب اللي بيفتحوا الصفحة بيتابعوا طلبهم، مش
 * بيرجّعوا — فالنموذج ما ياخدش المساحة إلا لما يطلبه.
 */
export function ReturnForm({
  storeIdentifier,
  orderNumber,
  token,
  items,
  currency,
}: {
  storeIdentifier: string
  orderNumber: number
  token: string
  items: Item[]
  currency: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<'refund' | 'exchange'>('refund')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [picked, setPicked] = useState<Record<string, number>>({})
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, start] = useTransition()

  const chosen = Object.entries(picked).filter(([, q]) => q > 0)
  const refundTotal = chosen.reduce((sum, [id, q]) => {
    const item = items.find((i) => i.id === id)
    return sum + (item ? item.price * q : 0)
  }, 0)

  function submit() {
    setError(null)
    start(async () => {
      const res = await requestReturnAction({
        storeIdentifier,
        orderNumber,
        token,
        type,
        reason,
        note: note || undefined,
        items: chosen.map(([orderItemId, quantity]) => ({ orderItemId, quantity })),
      })
      if (res?.error) {
        setError(res.error)
        return
      }
      setDone(true)
      router.refresh()
    })
  }

  if (done) {
    return (
      <div className="mt-6 rounded-[var(--sf-radius)] border border-green-300 bg-green-50 p-4 text-sm text-green-800">
        <p className="font-semibold">اتسجّل طلب الإرجاع</p>
        <p className="mt-1">هنراجعه ونتواصل معاك قريب.</p>
      </div>
    )
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-6 flex min-h-11 items-center justify-center gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 px-4 text-sm font-medium opacity-75 transition-opacity hover:opacity-100"
      >
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        طلب إرجاع أو استبدال
      </button>
    )
  }

  const field =
    'w-full rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 outline-none focus:border-[var(--sf-primary)]'

  return (
    <div className="mt-6 flex flex-col gap-4 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 p-4">
      <h3 className="font-bold">طلب إرجاع أو استبدال</h3>

      {error && (
        <p className="rounded-[var(--sf-radius)] bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-2">
        {(['refund', 'exchange'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            aria-pressed={type === t}
            className={`min-h-10 flex-1 rounded-[var(--sf-radius)] border px-3 text-sm font-medium transition-colors ${
              type === t
                ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/10 text-[var(--sf-primary)]'
                : 'border-[var(--sf-text)]/18 opacity-70'
            }`}
          >
            {t === 'refund' ? 'استرداد فلوس' : 'استبدال'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">المنتجات اللي عايز ترجّعها</span>
        {items.map((i) => (
          <label
            key={i.id}
            className="flex items-center gap-3 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 p-2.5"
          >
            <input
              type="checkbox"
              checked={(picked[i.id] ?? 0) > 0}
              onChange={(e) => setPicked((p) => ({ ...p, [i.id]: e.target.checked ? 1 : 0 }))}
              className="h-4 w-4 accent-[var(--sf-primary)]"
            />
            <span className="min-w-0 flex-1 truncate text-sm">{i.name}</span>
            {(picked[i.id] ?? 0) > 0 && i.quantity > 1 && (
              <input
                type="number"
                min={1}
                max={i.quantity}
                value={picked[i.id]}
                onChange={(e) =>
                  setPicked((p) => ({
                    ...p,
                    [i.id]: Math.min(i.quantity, Math.max(1, Number(e.target.value))),
                  }))
                }
                dir="ltr"
                aria-label={`كمية ${i.name}`}
                className="h-9 w-16 rounded-md border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-2 text-start text-sm tabular-nums"
              />
            )}
            <span className="tabular shrink-0 text-sm opacity-65">
              {formatMoney(i.price, currency)}
            </span>
          </label>
        ))}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">سبب الإرجاع</span>
        <select value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} h-11`}>
          <option value="">اختار السبب…</option>
          {RETURN_REASONS.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">تفاصيل إضافية (اختياري)</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className={`${field} py-2.5 text-sm`}
        />
      </label>

      {refundTotal > 0 && (
        <p className="text-sm">
          المبلغ المتوقّع:{' '}
          <span className="tabular font-bold">{formatMoney(refundTotal, currency)}</span>
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={pending || chosen.length === 0 || !reason}
          className="min-h-11 flex-1 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-4 font-semibold text-white disabled:opacity-50"
        >
          {pending ? 'بنسجّل…' : 'إرسال الطلب'}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="min-h-11 rounded-[var(--sf-radius)] px-4 text-sm opacity-70"
        >
          إلغاء
        </button>
      </div>
    </div>
  )
}
