'use client'

import { useMemo, useState } from 'react'
import { ChevronDown, User } from 'lucide-react'
import { Card } from '@/components/ui'
import { formatDateTime } from '@/lib/utils'

export type ActivityRow = {
  id: string
  action: string
  label: string
  resource: string | null
  resourceId: string | null
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  ip: string | null
  createdAt: Date
  userName: string | null
  userEmail: string | null
}

/** الإجراءات اللي بترجع صعب أو بتلمس فلوس — بتتلوّن عشان تلفت */
const RISKY = new Set([
  'product.delete',
  'order.cancel',
  'shipment.delete',
  'shipment.cod_settled',
  'supplier.delete',
  'reward.delete',
  'coupon.delete',
  'apikey.revoke',
  'store.unpublish',
  'member.role_change',
])

export function ActivityList({ items }: { items: ActivityRow[] }) {
  const [who, setWho] = useState<string>('')

  /*
    الفلترة بالشخص هي أول حاجة التاجر بيعملها لما يشك في حاجة:
    «أنا عايز أشوف عمل إيه إمبارح». الفلترة بالنوع أقل إلحاحًا.
  */
  const people = useMemo(() => {
    const set = new Map<string, string>()
    for (const i of items) {
      const key = i.userEmail ?? 'system'
      if (!set.has(key)) set.set(key, i.userName ?? i.userEmail ?? 'النظام')
    }
    return [...set.entries()]
  }, [items])

  const visible = who ? items.filter((i) => (i.userEmail ?? 'system') === who) : items

  return (
    <div className="flex flex-col gap-3">
      {people.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setWho('')}
            className={`min-h-9 rounded-lg px-3 text-sm transition-colors ${
              !who
                ? 'bg-[var(--primary)] font-medium text-[var(--primary-fg)]'
                : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)]'
            }`}
          >
            الكل
          </button>
          {people.map(([key, name]) => (
            <button
              key={key}
              type="button"
              onClick={() => setWho(key)}
              className={`min-h-9 rounded-lg px-3 text-sm transition-colors ${
                who === key
                  ? 'bg-[var(--primary)] font-medium text-[var(--primary-fg)]'
                  : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {name}
            </button>
          ))}
        </div>
      )}

      <Card className="overflow-hidden">
        <ul className="divide-y divide-[var(--border)]">
          {visible.map((i) => (
            <ActivityItem key={i.id} row={i} />
          ))}
        </ul>
      </Card>
    </div>
  )
}

function ActivityItem({ row: i }: { row: ActivityRow }) {
  const [open, setOpen] = useState(false)
  const hasDetail = Boolean(i.before || i.after)
  const risky = RISKY.has(i.action)

  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-md px-2 py-0.5 text-xs font-medium"
          style={
            risky
              ? { background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }
              : { background: 'var(--surface-2)', color: 'var(--fg-muted)' }
          }
        >
          {i.label}
        </span>

        <span className="flex items-center gap-1 text-sm">
          <User className="h-3.5 w-3.5 text-[var(--fg-subtle)]" aria-hidden="true" />
          {i.userName ?? i.userEmail ?? 'النظام'}
        </span>

        <span className="tabular ms-auto text-xs text-[var(--fg-subtle)]">
          {formatDateTime(i.createdAt)}
        </span>

        {hasDetail && (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-xs text-[var(--fg-muted)]"
          >
            التفاصيل
            <ChevronDown
              className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      {open && hasDetail && (
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {i.before && <Snapshot title="قبل" data={i.before} />}
          {i.after && <Snapshot title="بعد" data={i.after} />}
        </div>
      )}
    </li>
  )
}

function Snapshot({ title, data }: { title: string; data: Record<string, unknown> }) {
  return (
    <div className="rounded-lg bg-[var(--surface-2)] p-2.5">
      <span className="text-xs font-medium text-[var(--fg-muted)]">{title}</span>
      <pre className="mt-1 overflow-x-auto text-xs whitespace-pre-wrap">
        {JSON.stringify(data, null, 1)}
      </pre>
    </div>
  )
}
