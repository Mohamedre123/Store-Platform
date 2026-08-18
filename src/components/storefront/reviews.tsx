'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, Star } from 'lucide-react'
import { submitReviewAction } from '@/app/s/[store]/products/[slug]/review-actions'

export type Review = {
  id: string
  authorName: string
  rating: number
  body: string | null
  isVerifiedPurchase: boolean
  merchantReply: string | null
  createdAt: Date
}

function Stars({ value, size = 'sm' }: { value: number; size?: 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'h-6 w-6' : 'h-3.5 w-3.5'
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} من ٥`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={`${cls} ${i <= value ? 'fill-current text-amber-500' : 'text-[var(--sf-text)]/20'}`}
          aria-hidden="true"
        />
      ))}
    </span>
  )
}

export function ProductReviews({
  storeIdentifier,
  productId,
  reviews,
  ratingAverage,
  ratingCount,
}: {
  storeIdentifier: string
  productId: string
  reviews: Review[]
  ratingAverage: number | null
  ratingCount: number
}) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [rating, setRating] = useState(5)
  const [body, setBody] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [pending, start] = useTransition()

  function submit() {
    setMsg(null)
    start(async () => {
      const res = await submitReviewAction({
        storeIdentifier,
        productId,
        authorName: name,
        phone: phone || undefined,
        rating,
        body: body || undefined,
      })
      if (res?.error) {
        setMsg({ ok: false, text: res.error })
      } else {
        setMsg({ ok: true, text: 'شكرًا! مراجعتك هتظهر بعد مراجعة المتجر.' })
        setName('')
        setPhone('')
        setBody('')
        setOpen(false)
      }
    })
  }

  const input =
    'h-11 w-full rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 text-sm outline-none focus:border-[var(--sf-primary)]'

  return (
    <section className="mt-12 border-t border-[var(--sf-text)]/10 pt-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold">آراء العملاء</h2>
          {ratingAverage !== null && (
            <span className="flex items-center gap-2">
              <Stars value={Math.round(ratingAverage)} />
              <span className="tabular text-sm opacity-70">
                {ratingAverage.toFixed(1)} ({ratingCount})
              </span>
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="min-h-10 rounded-[var(--sf-radius)] border border-[var(--sf-primary)] px-4 text-sm font-semibold text-[var(--sf-primary)] transition-colors hover:bg-[var(--sf-primary)]/8"
        >
          {open ? 'إلغاء' : 'اكتب رأيك'}
        </button>
      </div>

      {msg && (
        <p className={`mb-4 text-sm ${msg.ok ? 'text-green-600' : 'text-red-600'}`} role="status">
          {msg.text}
        </p>
      )}

      {open && (
        <div className="mb-8 flex flex-col gap-3 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 p-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">تقييمك</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setRating(i)}
                  aria-label={`${i} من ٥`}
                  aria-pressed={rating === i}
                  className="p-1"
                >
                  <Star
                    className={`h-7 w-7 transition-colors ${
                      i <= rating ? 'fill-current text-amber-500' : 'text-[var(--sf-text)]/25'
                    }`}
                    aria-hidden="true"
                  />
                </button>
              ))}
            </div>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">اسمك</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="محمد أحمد" />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">رقم تليفونك (اختياري)</span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              dir="ltr"
              className={`${input} text-start`}
              placeholder="01012345678"
            />
            <span className="text-xs opacity-60">
              لو طلبت المنتج ده قبل كده، مراجعتك هتظهر بعلامة «شراء موثّق».
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">رأيك</span>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={3}
              className="rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-[var(--sf-primary)]"
              placeholder="إيه رأيك في المنتج؟"
            />
          </label>

          <button
            type="button"
            onClick={submit}
            disabled={pending || name.trim().length < 2}
            className="min-h-11 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {pending ? 'بيتبعت…' : 'ابعت رأيك'}
          </button>
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="py-6 text-center text-sm opacity-60">
          لسه مافيش آراء على المنتج ده. كن أول واحد يكتب رأيه.
        </p>
      ) : (
        <ul className="flex flex-col gap-5">
          {reviews.map((r) => (
            <li key={r.id} className="border-b border-[var(--sf-text)]/8 pb-5 last:border-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{r.authorName}</span>
                {r.isVerifiedPurchase && (
                  <span className="flex items-center gap-1 rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                    <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                    شراء موثّق
                  </span>
                )}
              </div>
              <div className="mt-1">
                <Stars value={r.rating} />
              </div>
              {r.body && <p className="mt-2 text-sm leading-relaxed opacity-80">{r.body}</p>}
              {r.merchantReply && (
                <div className="mt-3 rounded-[var(--sf-radius)] bg-[var(--sf-text)]/5 p-3">
                  <span className="text-xs font-medium opacity-70">رد المتجر</span>
                  <p className="mt-1 text-sm leading-relaxed opacity-80">{r.merchantReply}</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
