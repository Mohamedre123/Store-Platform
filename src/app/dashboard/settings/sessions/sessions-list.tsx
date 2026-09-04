'use client'

import { useState, useTransition } from 'react'
import { Laptop, LogOut, Smartphone, Tablet } from 'lucide-react'
import { revokeOtherSessionsAction, revokeSessionAction } from './actions'
import { Button, Card } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'
import { formatDateTime } from '@/lib/utils'

export type SessionRow = {
  id: string
  device: 'mobile' | 'tablet' | 'desktop'
  label: string
  ip: string | null
  createdAt: string
  expiresAt: string
  isCurrent: boolean
}

const ICONS = { mobile: Smartphone, tablet: Tablet, desktop: Laptop }

/**
 * الأجهزة اللي داخلة على الحساب.
 *
 * ## ليه دي مهمة هنا بالذات
 * الحساب ده بيمسك متجرًا وفلوس عملاء. التاجر اللي دخل من جهاز صاحبه
 * أو من كافيه ونسي يخرج مالوش أي طريق يقفل الجلسة دي — غير إنه
 * يغيّر كلمة سرّه، وده بيخرّجه هو كمان من كل أجهزته.
 */
export function SessionsList({ rows }: { rows: SessionRow[] }) {
  const others = rows.filter((r) => !r.isCurrent).length

  return (
    <div className="flex flex-col gap-4">
      {others > 0 && <RevokeAll count={others} />}

      <Card className="divide-y divide-[var(--border)]">
        {rows.map((r) => {
          const Icon = ICONS[r.device]
          return (
            <div key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--fg-muted)]">
                <Icon className="h-4 w-4" aria-hidden="true" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-sm font-medium">{r.label}</span>
                  {r.isCurrent && (
                    <span className="rounded bg-[var(--color-success-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-success)]">
                      الجهاز ده
                    </span>
                  )}
                </span>
                <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
                  دخل {formatDateTime(r.createdAt)}
                  {r.ip ? ` · ${r.ip}` : ''}
                </span>
              </span>

              {!r.isCurrent && <RevokeOne id={r.id} label={r.label} />}
            </div>
          )
        })}
      </Card>
    </div>
  )
}

function RevokeOne({ id, label }: { id: string; label: string }) {
  const [pending, start] = useTransition()
  return (
    <Button
      size="sm"
      variant="secondary"
      loading={pending}
      aria-label={`اقفل جلسة ${label}`}
      onClick={() =>
        start(async () => {
          const res = await revokeSessionAction(id)
          if (res?.error) toast(res.error, 'error')
          else toast('اتقفلت')
        })
      }
    >
      اقفلها
    </Button>
  )
}

function RevokeAll({ count }: { count: number }) {
  const [confirming, setConfirming] = useState(false)
  const [pending, start] = useTransition()

  return (
    <Card className="flex flex-wrap items-center gap-3 p-4">
      <LogOut className="h-5 w-5 shrink-0 text-[var(--fg-muted)]" aria-hidden="true" />
      <span className="flex-1 text-sm">
        <span className="font-semibold">
          فيه <span className="tabular">{count}</span> جهاز تاني داخل على حسابك
        </span>
        <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">
          لو فيهم واحد مش بتاعك، اقفلهم كلهم. جهازك ده هيفضل مفتوح.
        </span>
      </span>

      {confirming ? (
        <span className="flex gap-2">
          <Button
            size="sm"
            variant="danger"
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await revokeOtherSessionsAction()
                toast(`اتقفل ${res?.closed ?? 0} جهاز`)
                setConfirming(false)
              })
            }
          >
            أكيد
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
            إلغاء
          </Button>
        </span>
      ) : (
        <Button size="sm" variant="secondary" onClick={() => setConfirming(true)}>
          اقفل الباقي
        </Button>
      )}
    </Card>
  )
}
