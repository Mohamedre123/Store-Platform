'use client'

import { useState, useTransition } from 'react'
import { Check, Gift, Loader2 } from 'lucide-react'
import { startTrialAction } from './actions'
import { Card } from '@/components/ui'

/**
 * كارت التجربة المجانية.
 *
 * الزرار بيشتغل **من غير ما التاجر يكلّم حد** — التجربة مبتكلّفش
 * حاجة فمفيش سبب يستنى مننا عشان يجرّب. الباقات المدفوعة تحتها
 * عكسها: ما بتتفعّلش غير بإيد الإدارة بعد ما تشوف التحويل.
 */
export function TrialCard({
  name,
  tagline,
  state,
  daysLeft,
}: {
  name: string
  tagline: string
  /** available = ينفع يبدأها · running = شغّالة · used = خلصت */
  state: 'available' | 'running' | 'used'
  daysLeft: number | null
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
            <Gift className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold">{name}</h3>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
              {state === 'running'
                ? `شغّالة دلوقتي — فاضل ${daysLeft ?? 0} يوم، وكل المميزات مفتوحة.`
                : state === 'used'
                  ? 'اتستخدمت خلاص. اختار باقة عشان المميزات ترجع تتفتح.'
                  : tagline}
            </p>
          </div>
        </div>

        {state === 'available' ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setError(null)
              start(async () => {
                const res = await startTrialAction()
                if (res?.error) setError(res.error)
              })
            }}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-[var(--color-warning)] px-5 text-sm font-bold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Gift className="h-4 w-4" aria-hidden="true" />
            )}
            ابدأ التجربة المجانية
          </button>
        ) : (
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium"
            style={{
              background: state === 'running' ? 'var(--color-success-soft)' : 'var(--surface-2)',
              color: state === 'running' ? 'var(--color-success)' : 'var(--fg-muted)',
            }}
          >
            {state === 'running' && <Check className="h-4 w-4" aria-hidden="true" />}
            {state === 'running' ? 'شغّالة' : 'اتستخدمت'}
          </span>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm font-medium text-[var(--color-danger)]">
          {error}
        </p>
      )}
    </Card>
  )
}
