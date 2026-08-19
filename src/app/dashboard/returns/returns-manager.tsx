'use client'

import { useState, useTransition } from 'react'
import { MessageSquare, Phone, RefreshCw } from 'lucide-react'
import { setReturnNoteAction, updateReturnStatusAction } from './actions'
import { RETURN_STATUSES, returnStatusMeta } from '@/lib/returns-meta'
import type { ReturnStatus } from '@/lib/returns-meta'
import { Card } from '@/components/ui'
import { formatDate, formatMoney } from '@/lib/utils'

export type ReturnRow = {
  id: string
  returnNumber: number
  type: 'refund' | 'exchange'
  status: ReturnStatus
  reason: string | null
  customerNote: string | null
  merchantNote: string | null
  refundAmount: number
  createdAt: Date
  orderNumber: number
  customerName: string | null
  customerPhone: string | null
}

export function ReturnsManager({ returns, currency }: { returns: ReturnRow[]; currency: string }) {
  return (
    <div className="flex flex-col gap-3">
      {returns.map((r) => (
        <ReturnCard key={r.id} row={r} currency={currency} />
      ))}
    </div>
  )
}

function ReturnCard({ row: r, currency }: { row: ReturnRow; currency: string }) {
  const [pending, start] = useTransition()
  const [noting, setNoting] = useState(false)
  const [note, setNote] = useState(r.merchantNote ?? '')
  const meta = returnStatusMeta(r.status)

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-bold">مرتجع #{r.returnNumber}</span>
            <span
              className="rounded-md px-2 py-0.5 text-xs font-medium"
              style={{ background: meta.bg, color: meta.fg }}
            >
              {meta.label}
            </span>
            <span className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]">
              {r.type === 'refund' ? 'استرداد' : 'استبدال'}
            </span>
          </div>

          <p className="mt-1 text-sm text-[var(--fg-muted)]">
            طلب <span className="tabular font-medium">#{r.orderNumber}</span>
            {r.customerName && ` · ${r.customerName}`} · {formatDate(r.createdAt)}
          </p>

          {r.reason && <p className="mt-2 text-sm">السبب: {r.reason}</p>}
          {r.customerNote && (
            <p className="mt-1 text-sm text-[var(--fg-muted)]">«{r.customerNote}»</p>
          )}

          {r.merchantNote && !noting && (
            <div className="mt-2 rounded-lg bg-[var(--surface-2)] p-2.5">
              <span className="text-xs font-medium text-[var(--fg-muted)]">ملاحظتك</span>
              <p className="mt-0.5 text-sm text-[var(--fg-muted)]">{r.merchantNote}</p>
            </div>
          )}
        </div>

        <div className="text-end">
          <span className="tabular block font-bold">{formatMoney(r.refundAmount, currency)}</span>
          {r.customerPhone && (
            <a
              href={`tel:${r.customerPhone}`}
              className="mt-1 inline-flex items-center gap-1 text-xs text-[var(--primary)] hover:underline"
            >
              <Phone className="h-3 w-3" aria-hidden="true" />
              اتصال
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-3">
        <label className="flex items-center gap-2 text-sm">
          <RefreshCw className="h-4 w-4 text-[var(--fg-subtle)]" aria-hidden="true" />
          <span className="sr-only">حالة المرتجع</span>
          <select
            value={r.status}
            disabled={pending}
            onChange={(e) =>
              start(() => updateReturnStatusAction(r.id, e.target.value as ReturnStatus).then(() => {}))
            }
            className="h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
          >
            {RETURN_STATUSES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => setNoting((v) => !v)}
          className="flex min-h-10 items-center gap-1.5 rounded-lg px-3 text-sm text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <MessageSquare className="h-4 w-4" aria-hidden="true" />
          ملاحظة
        </button>

        {r.status === 'completed' && (
          <span className="text-xs text-[var(--color-success)]">الكميات رجعت للمخزون</span>
        )}
      </div>

      {noting && (
        <div className="flex flex-col gap-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="ملاحظة داخلية — العميل مش بيشوفها"
            className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  await setReturnNoteAction(r.id, note)
                  setNoting(false)
                })
              }
              disabled={pending}
              className="min-h-9 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-fg)] disabled:opacity-60"
            >
              حفظ
            </button>
            <button
              type="button"
              onClick={() => setNoting(false)}
              className="min-h-9 rounded-lg px-3 text-sm text-[var(--fg-muted)]"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}
