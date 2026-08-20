'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Card } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'

export type MessageRow = {
  id: string
  channel: string
  event: string | null
  recipient: string
  body: string | null
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  provider: string | null
  errorMessage: string | null
  orderId: string | null
  sentAt: Date | null
  createdAt: Date
}

/** أسماء أنواع الرسايل بالعربي — المفتاح إنجليزي في قاعدة البيانات */
const EVENT_LABELS: Record<string, string> = {
  order_confirmation: 'تأكيد طلب',
  merchant_new_order: 'إشعار طلب جديد',
  abandoned_cart: 'تذكير سلة متروكة',
  order_otp: 'رمز تحقق',
  order_confirmed: 'الطلب اتأكّد',
  order_processing: 'الطلب بيتجهّز',
  order_shipped: 'الطلب اتشحن',
  order_delivered: 'الطلب اتسلّم',
  order_cancelled: 'الطلب اتلغى',
  automation: 'أتمتة',
}

const STATUS_META: Record<string, { label: string; bg: string; fg: string }> = {
  queued: { label: 'في الطابور', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
  sent: { label: 'اتبعتت', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  delivered: { label: 'وصلت', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  read: { label: 'اتقرت', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  failed: { label: 'فشلت', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
}

export function MessagesList({ messages }: { messages: MessageRow[] }) {
  const [onlyFailed, setOnlyFailed] = useState(false)

  const visible = useMemo(
    () => (onlyFailed ? messages.filter((m) => m.status === 'failed') : messages),
    [messages, onlyFailed],
  )

  const failedCount = messages.filter((m) => m.status === 'failed').length

  return (
    <div className="flex flex-col gap-3">
      {failedCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setOnlyFailed(false)}
            className={`min-h-9 rounded-lg px-3 text-sm transition-colors ${
              !onlyFailed
                ? 'bg-[var(--primary)] font-medium text-[var(--primary-fg)]'
                : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            الكل <span className="tabular opacity-70">{messages.length}</span>
          </button>
          <button
            type="button"
            onClick={() => setOnlyFailed(true)}
            className={`min-h-9 rounded-lg px-3 text-sm transition-colors ${
              onlyFailed
                ? 'bg-[var(--primary)] font-medium text-[var(--primary-fg)]'
                : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            اللي فشلت <span className="tabular opacity-70">{failedCount}</span>
          </button>
        </div>
      )}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-[var(--border)]">
          {visible.map((m) => (
            <MessageItem key={m.id} row={m} />
          ))}
        </ul>
      </Card>
    </div>
  )
}

function MessageItem({ row: m }: { row: MessageRow }) {
  const [open, setOpen] = useState(false)
  const meta = STATUS_META[m.status] ?? STATUS_META.queued
  const label = (m.event && EVENT_LABELS[m.event]) || m.event || 'رسالة'

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-xs font-medium"
          style={{ background: meta.bg, color: meta.fg }}
        >
          {meta.label}
        </span>
        <span className="text-sm font-medium">{label}</span>
        <bdi dir="ltr" className="text-sm text-[var(--fg-muted)]">
          {m.recipient}
        </bdi>

        {m.orderId && (
          <Link
            href={`/dashboard/orders/${m.orderId}`}
            className="text-xs text-[var(--primary)] hover:underline"
          >
            الطلب
          </Link>
        )}

        <span className="tabular ms-auto text-xs text-[var(--fg-subtle)]">
          {formatDateTime(m.createdAt)}
        </span>

        {m.errorMessage && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-[var(--color-danger)]"
          >
            السبب
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {m.body && <p className="mt-1 truncate text-xs text-[var(--fg-subtle)]">{m.body}</p>}

      {open && m.errorMessage && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-[var(--surface-2)] p-2.5 text-xs whitespace-pre-wrap">
          {m.errorMessage}
        </pre>
      )}
    </li>
  )
}
