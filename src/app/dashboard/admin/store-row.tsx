'use client'

import { useState, useTransition } from 'react'
import { Ban, Check, Clock, Crown, Gift, Loader2, Store, X } from 'lucide-react'
import { activateAction, deactivateAction, rejectRequestAction } from './actions'

export type AdminStoreRow = {
  storeId: string
  storeName: string
  storeSlug: string
  ownerName: string
  ownerEmail: string
  accountId: string | null
  status: string
  statusLabel: string
  planName: string | null
  until: string | null
  daysLeft: number | null
  active: boolean
  orders: number
  /** طلب اشتراك معلّق — لو موجود، التفعيل بيقفله معاه */
  request: {
    id: string
    planKey: 'trial' | 'monthly' | 'yearly'
    planName: string
    amount: string
    method: string
    at: string
  } | null
}

const PLAN_BUTTONS = [
  { key: 'monthly' as const, label: 'شهري', icon: Crown },
  { key: 'yearly' as const, label: 'سنوي', icon: Crown },
  { key: 'trial' as const, label: 'تجربة ٣ أيام', icon: Gift },
]

/**
 * صف تاجر في لوحة الإدارة.
 *
 * الأزرار كلها بتأكيد قبل التنفيذ. التفعيل بيدّي شهر أو سنة مجانًا لو
 * اتضغط بالغلط، والإلغاء بيقفل متجر شغّال — والاتنين على متجر حد
 * تاني، فالضغطة الواحدة مش كفاية.
 */
export function StoreRow({ row }: { row: AdminStoreRow }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [pending, start] = useTransition()

  function run(fn: () => Promise<{ ok?: boolean; error?: string; message?: string } | null>) {
    setConfirming(null)
    setMsg(null)
    start(async () => {
      const res = await fn()
      if (res?.error) setMsg({ ok: false, text: res.error })
      else if (res?.message) setMsg({ ok: true, text: res.message })
    })
  }

  return (
    <div className="surface flex flex-col gap-4 p-4">
      {/* الهوية */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
            <Store className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{row.storeName}</h3>
            <p dir="ltr" className="truncate text-start text-xs text-[var(--fg-subtle)]">
              {row.storeSlug}
            </p>
          </div>
        </div>

        <span
          className="shrink-0 rounded-md px-2 py-1 text-xs font-medium"
          style={{
            background: row.active ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
            color: row.active ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          {row.statusLabel}
        </span>
      </div>

      {/* البيانات */}
      <dl className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-2">
        <Row label="معرّف الحساب">
          <bdi dir="ltr" className="tabular font-bold tracking-wider">
            {row.accountId ?? '—'}
          </bdi>
        </Row>
        <Row label="صاحب الحساب">
          <span className="truncate">{row.ownerName}</span>
        </Row>
        <Row label="البريد">
          <bdi dir="ltr" className="truncate text-start text-xs">
            {row.ownerEmail}
          </bdi>
        </Row>
        <Row label="الطلبات">
          <span className="tabular">{row.orders}</span>
        </Row>
        <Row label="الباقة">
          <span>{row.planName ?? '—'}</span>
        </Row>
        <Row label="بينتهي">
          <span className="text-xs">
            {row.until ?? '—'}
            {row.daysLeft !== null && row.daysLeft >= 0 && (
              <span className="text-[var(--fg-subtle)]"> · فاضل {row.daysLeft} يوم</span>
            )}
          </span>
        </Row>
      </dl>

      {/* طلب معلّق */}
      {row.request && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--color-info)]/40 bg-[var(--color-info-soft)] p-3">
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--color-info)]">
            <Clock className="h-4 w-4 shrink-0" aria-hidden="true" />
            طلب {row.request.planName} · {row.request.amount} ·{' '}
            {row.request.method === 'instapay' ? 'إنستا باي' : 'محفظة'} · {row.request.at}
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => rejectRequestAction({ requestId: row.request!.id }))}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--color-info)]/40 px-3 text-xs font-medium text-[var(--color-info)] transition-colors hover:bg-[var(--surface)] disabled:opacity-60"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            ارفض الطلب
          </button>
        </div>
      )}

      {/* الأزرار */}
      <div className="flex flex-wrap gap-2">
        {PLAN_BUTTONS.map((b) => {
          const Icon = b.icon
          const key = 'activate:' + b.key
          const asking = confirming === key
          return (
            <button
              key={b.key}
              type="button"
              disabled={pending}
              onClick={() =>
                asking
                  ? run(() =>
                      activateAction({
                        storeId: row.storeId,
                        plan: b.key,
                        requestId: row.request?.id,
                      }),
                    )
                  : setConfirming(key)
              }
              className={`inline-flex min-h-11 flex-1 basis-32 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
                asking
                  ? 'bg-[var(--color-success)] text-white'
                  : 'border border-[var(--border-strong)] text-[var(--fg)] hover:bg-[var(--surface-2)]'
              }`}
            >
              {pending && asking ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : asking ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Icon className="h-4 w-4" aria-hidden="true" />
              )}
              {asking ? 'أكّد' : 'فعّل ' + b.label}
            </button>
          )
        })}

        <button
          type="button"
          disabled={pending}
          onClick={() =>
            confirming === 'off'
              ? run(() => deactivateAction(row.storeId))
              : setConfirming('off')
          }
          className={`inline-flex min-h-11 flex-1 basis-32 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors disabled:opacity-60 ${
            confirming === 'off'
              ? 'bg-[var(--color-danger)] text-white'
              : 'border border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]'
          }`}
        >
          {pending && confirming === 'off' ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Ban className="h-4 w-4" aria-hidden="true" />
          )}
          {confirming === 'off' ? 'أكّد الإلغاء' : 'ألغِ التفعيل'}
        </button>
      </div>

      {confirming && (
        <p className="text-xs text-[var(--fg-subtle)]">
          دوس تاني عشان تأكّد، أو{' '}
          <button
            type="button"
            onClick={() => setConfirming(null)}
            className="underline hover:text-[var(--fg)]"
          >
            ارجع
          </button>
          .
        </p>
      )}

      {msg && (
        <p
          className="rounded-lg px-3 py-2 text-sm font-medium"
          style={{
            background: msg.ok ? 'var(--color-success-soft)' : 'var(--color-danger-soft)',
            color: msg.ok ? 'var(--color-success)' : 'var(--color-danger)',
          }}
        >
          {msg.text}
        </p>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2">
      <dt className="shrink-0 text-xs text-[var(--fg-subtle)]">{label}</dt>
      <dd className="min-w-0 flex-1 truncate">{children}</dd>
    </div>
  )
}
