'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Eye, EyeOff, Globe, Loader2 } from 'lucide-react'
import { togglePublishAction } from './actions'

/**
 * بانر النشر — أهم زرار في اللوحة.
 *
 * طول ما المتجر مش منشور، العميل ميقدرش يفتحه أو يطلب. البانر ده بيبقى
 * بارز فوق لحد ما التاجر ينشر، وبعدها بيتحوّل لتأكيد هادي مع إمكانية
 * الإيقاف. من غيره التاجر مش هيعرف يشغّل متجره أصلًا.
 */
export function PublishBanner({ initialPublished, storeUrl }: { initialPublished: boolean; storeUrl: string }) {
  const [published, setPublished] = useState(initialPublished)
  const [pending, start] = useTransition()

  function toggle(next: boolean) {
    start(async () => {
      const res = await togglePublishAction(next)
      if (res?.ok) setPublished(res.isPublished)
    })
  }

  if (!published) {
    return (
      <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-warning)]/40 bg-[var(--color-warning-soft)] p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <EyeOff className="mt-0.5 h-6 w-6 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
          <div>
            <h2 className="font-bold text-[var(--fg)]">متجرك لسه مش منشور</h2>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
              العملاء مش هيقدروا يفتحوه أو يطلبوا منه لحد ما تنشره. جهّز منتجاتك وشكلك، وبعدين انشر.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => toggle(true)}
          disabled={pending}
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Globe className="h-4 w-4" aria-hidden="true" />}
          انشر المتجر دلوقتي
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
        <div>
          <span className="text-sm font-semibold text-[var(--fg)]">متجرك منشور وشغّال</span>
          <a
            href={storeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="ms-2 inline-flex items-center gap-1 text-sm text-[var(--primary)] hover:underline"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            افتح المتجر
          </a>
        </div>
      </div>
      <button
        type="button"
        onClick={() => toggle(false)}
        disabled={pending}
        className="flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-60"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
        إيقاف مؤقت
      </button>
    </div>
  )
}
