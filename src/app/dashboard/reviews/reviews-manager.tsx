'use client'

import { useState, useTransition } from 'react'
import { Check, CheckCircle2, MessageSquare, Star, Trash2, X } from 'lucide-react'
import { approveReviewAction, deleteReviewAction, replyToReviewAction } from './actions'
import { Card } from '@/components/ui'
import { formatDate } from '@/lib/utils'

export type ReviewRow = {
  id: string
  authorName: string
  rating: number
  body: string | null
  isVerifiedPurchase: boolean
  isApproved: boolean
  merchantReply: string | null
  createdAt: Date
  productName: string | null
}

export function ReviewsManager({ reviews }: { reviews: ReviewRow[] }) {
  const pendingList = reviews.filter((r) => !r.isApproved)
  const approved = reviews.filter((r) => r.isApproved)

  if (reviews.length === 0) {
    return (
      <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
        <Star className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
        <h2 className="text-lg font-semibold">لسه مافيش مراجعات</h2>
        <p className="max-w-sm text-sm text-[var(--fg-muted)]">
          أول ما عميل يكتب رأيه على منتج، هيظهر هنا عشان توافق عليه.
        </p>
      </Card>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      {pendingList.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">
            مستنية موافقتك{' '}
            <span className="rounded-md bg-[var(--color-warning-soft)] px-2 py-0.5 text-xs text-[var(--color-warning)]">
              {pendingList.length}
            </span>
          </h2>
          {pendingList.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </section>
      )}

      {approved.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">معتمدة</h2>
          {approved.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </section>
      )}
    </div>
  )
}

function ReviewCard({ review: r }: { review: ReviewRow }) {
  const [pending, start] = useTransition()
  const [replying, setReplying] = useState(false)
  const [reply, setReply] = useState(r.merchantReply ?? '')
  const [confirming, setConfirming] = useState(false)

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{r.authorName}</span>
            {r.isVerifiedPurchase && (
              <span className="flex items-center gap-1 rounded-md bg-[var(--color-success-soft)] px-2 py-0.5 text-xs font-medium text-[var(--color-success)]">
                <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                شراء موثّق
              </span>
            )}
          </div>

          <div className="mt-1 flex items-center gap-2">
            <span className="flex" aria-label={`${r.rating} من ٥`}>
              {[1, 2, 3, 4, 5].map((i) => (
                <Star
                  key={i}
                  className={`h-3.5 w-3.5 ${i <= r.rating ? 'fill-current text-amber-500' : 'text-[var(--fg-subtle)]/30'}`}
                  aria-hidden="true"
                />
              ))}
            </span>
            <span className="text-xs text-[var(--fg-subtle)]">
              {r.productName ?? 'منتج متشال'} · {formatDate(r.createdAt)}
            </span>
          </div>

          {r.body && <p className="mt-2 text-sm leading-relaxed text-[var(--fg-muted)]">{r.body}</p>}

          {r.merchantReply && !replying && (
            <div className="mt-3 rounded-lg bg-[var(--surface-2)] p-3">
              <span className="text-xs font-medium text-[var(--fg-muted)]">ردّك</span>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">{r.merchantReply}</p>
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {!r.isApproved ? (
            <button
              type="button"
              onClick={() => start(() => approveReviewAction(r.id, true).then(() => {}))}
              disabled={pending}
              className="flex min-h-9 items-center gap-1.5 rounded-lg bg-[var(--primary)] px-3 text-sm font-medium text-[var(--primary-fg)] disabled:opacity-60"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              اعتمد
            </button>
          ) : (
            <button
              type="button"
              onClick={() => start(() => approveReviewAction(r.id, false).then(() => {}))}
              disabled={pending}
              className="flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm text-[var(--fg-muted)] disabled:opacity-60"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              إخفاء
            </button>
          )}

          <button
            type="button"
            onClick={() => setReplying((v) => !v)}
            aria-label="رد"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
          </button>

          {confirming ? (
            <button
              type="button"
              onClick={() => start(() => deleteReviewAction(r.id).then(() => {}))}
              disabled={pending}
              className="rounded-lg bg-[var(--color-danger)] px-3 py-2 text-xs font-medium text-white"
            >
              تأكيد
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label="حذف"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--color-danger-soft)] hover:text-[var(--color-danger)]"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {replying && (
        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-3">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={2}
            placeholder="ردّك بيظهر تحت المراجعة في متجرك…"
            className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  await replyToReviewAction(r.id, reply)
                  setReplying(false)
                })
              }
              disabled={pending}
              className="min-h-9 rounded-lg bg-[var(--primary)] px-4 text-sm font-medium text-[var(--primary-fg)] disabled:opacity-60"
            >
              حفظ الرد
            </button>
            <button
              type="button"
              onClick={() => setReplying(false)}
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
