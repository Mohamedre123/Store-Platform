'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { CheckCircle2, Eye, EyeOff, Globe, Loader2 } from 'lucide-react'
import { togglePublishAction } from './actions'

/**
 * بانر النشر — أهم زرار في اللوحة، بس لأول مرة بس.
 *
 * طول ما المتجر مش منشور، البانر بارز فوق. أول ما التاجر ينشر بيتحوّل
 * لرسالة نجاح قصيرة وبعدين يختفي خالص — عشان ما ياخدش مساحة دايمة في
 * لوحة بيدخلها كل يوم. الإيقاف بعد كده من صفحة المتجر، مكانه الطبيعي.
 */
export function PublishBanner({ initialPublished, storeUrl }: { initialPublished: boolean; storeUrl: string }) {
  const [published, setPublished] = useState(initialPublished)
  const [justPublished, setJustPublished] = useState(false)
  const [pending, start] = useTransition()

  // منشور من قبل الدخول = مفيش داعي لأي بانر
  if (published && !justPublished) return null

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
          onClick={() =>
            start(async () => {
              const res = await togglePublishAction(true)
              if (res?.ok) {
                setPublished(true)
                setJustPublished(true)
              }
            })
          }
          disabled={pending}
          className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Globe className="h-4 w-4" aria-hidden="true" />}
          انشر المتجر دلوقتي
        </button>
      </div>
    )
  }

  // اتنشر دلوقتي حالًا — تأكيد بيختفي بضغطة، والإيقاف من صفحة المتجر
  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--color-success)]/30 bg-[var(--color-success-soft)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
        <div>
          <span className="block font-semibold text-[var(--fg)]">متجرك اتنشر — بقى شغّال للعملاء</span>
          <span className="mt-0.5 block text-sm text-[var(--fg-muted)]">
            تقدر توقفه مؤقتًا في أي وقت من{' '}
            <Link href="/dashboard/storefront" className="font-medium text-[var(--primary)] hover:underline">
              صفحة المتجر
            </Link>
            .
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-10 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          افتح المتجر
        </a>
        <button
          type="button"
          onClick={() => setJustPublished(false)}
          className="flex min-h-10 items-center rounded-lg px-3 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          تمام
        </button>
      </div>
    </div>
  )
}
