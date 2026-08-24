'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Mail } from 'lucide-react'
import { subscribeAction } from '@/app/s/[store]/newsletter-actions'
import type { NewsletterBlock } from '@/lib/blocks'
import { BG_CLASS } from '@/lib/blocks'

/**
 * بلوك النشرة البريدية.
 *
 * البريد بيتسجّل في **عملاء التاجر** لا في قايمة منفصلة: العميل اللي
 * سجّل بريده هنا وبعدين طلب، لازم يبقى شخصًا واحدًا. القايمتين
 * المنفصلتين معناهما إن التاجر بيبعت نفس الحملة لنفس الشخص مرتين
 * ويحسبه اتنين في أرقامه.
 */
export function NewsletterBlockView({
  block,
  storeIdentifier,
}: {
  block: NewsletterBlock
  storeIdentifier: string
}) {
  const [email, setEmail] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const submit = () =>
    start(async () => {
      setError(null)
      const res = await subscribeAction({ storeIdentifier, email })
      if (res.ok) {
        setDone(true)
        setEmail('')
      } else {
        setError(res.error)
      }
    })

  return (
    <section className={`${BG_CLASS[block.background]} py-10 sm:py-14`}>
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-4 text-center sm:px-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--sf-primary)]/12 text-[var(--sf-primary)]">
          <Mail className="h-5 w-5" aria-hidden="true" />
        </span>

        {block.heading && (
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl" style={{ fontFamily: 'var(--sf-font-heading)' }}>
            {block.heading}
          </h2>
        )}
        {block.text && <p className="text-sm opacity-70">{block.text}</p>}

        {done ? (
          <p className="flex items-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)]/10 px-4 py-3 text-sm font-medium text-[var(--sf-primary)]">
            <Check className="h-4 w-4" aria-hidden="true" />
            تمام، سجّلناك. هيوصلك كل جديد.
          </p>
        ) : (
          <form
            className="flex w-full flex-col gap-2 sm:flex-row"
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              dir="ltr"
              autoComplete="email"
              placeholder={block.placeholder}
              aria-label={block.placeholder}
              className="h-12 min-w-0 flex-1 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-4 text-base outline-none transition-colors focus:border-[var(--sf-primary)]"
            />
            <button
              type="submit"
              disabled={pending || email.trim().length < 5}
              className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-6 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              {block.buttonLabel}
            </button>
          </form>
        )}

        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  )
}
