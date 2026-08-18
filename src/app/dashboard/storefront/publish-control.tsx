'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, EyeOff, Globe, Loader2 } from 'lucide-react'
import { togglePublishAction } from '../actions'
import { Card } from '@/components/ui'

/**
 * التحكّم الدائم في نشر المتجر — مكانه هنا مش في اللوحة الرئيسية.
 *
 * اللوحة الرئيسية بتعرض بانر النشر أول مرة بس؛ بعد كده التاجر بيتحكّم
 * من هنا، جنب شكل المتجر وثيمه — المكان اللي بيفكّر فيه في «المتجر» نفسه.
 */
export function PublishControl({ initialPublished }: { initialPublished: boolean }) {
  const [published, setPublished] = useState(initialPublished)
  const [pending, start] = useTransition()

  function toggle() {
    start(async () => {
      const res = await togglePublishAction(!published)
      if (res?.ok) setPublished(res.isPublished)
    })
  }

  return (
    <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <span
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
          style={{
            background: published ? 'var(--color-success-soft)' : 'var(--color-warning-soft)',
            color: published ? 'var(--color-success)' : 'var(--color-warning)',
          }}
        >
          {published ? <CheckCircle2 className="h-5 w-5" aria-hidden="true" /> : <EyeOff className="h-5 w-5" aria-hidden="true" />}
        </span>
        <div>
          <h2 className="font-semibold">{published ? 'المتجر منشور' : 'المتجر متوقّف'}</h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
            {published
              ? 'العملاء بيقدروا يفتحوه ويطلبوا منه دلوقتي.'
              : 'العملاء مش شايفينه — أي حد يفتح الرابط هيلاقي المتجر مقفول.'}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        className={`flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg px-5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-60 ${
          published
            ? 'border border-[var(--border-strong)] text-[var(--fg-muted)]'
            : 'bg-[var(--primary)] text-[var(--primary-fg)]'
        }`}
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : published ? (
          <EyeOff className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Globe className="h-4 w-4" aria-hidden="true" />
        )}
        {published ? 'إيقاف مؤقت' : 'انشر المتجر'}
      </button>
    </Card>
  )
}
