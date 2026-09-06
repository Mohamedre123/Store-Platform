'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, Gift, Loader2, PartyPopper, Sparkles, X } from 'lucide-react'
import { dismissNoticeAction, redeemNoticeAction } from '@/app/dashboard/notice-actions'
import type { MerchantNotice, NoticeTone } from '@/lib/notices'
import { cn, formatCount, formatDate } from '@/lib/utils'

const TONE: Record<
  NoticeTone,
  { icon: typeof Gift; ring: string; glow: string; badge: string; label: string }
> = {
  offer: {
    icon: Gift,
    ring: 'border-[var(--primary)]/40',
    glow: 'from-[var(--primary)]/18 via-[var(--primary)]/6 to-transparent',
    badge: 'bg-[var(--primary-soft)] text-[var(--primary)]',
    label: 'عرض ليك',
  },
  praise: {
    icon: PartyPopper,
    ring: 'border-[var(--color-success)]/40',
    glow: 'from-[var(--color-success)]/18 via-[var(--color-success)]/6 to-transparent',
    badge: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
    label: 'ألف مبروك',
  },
  info: {
    icon: Sparkles,
    ring: 'border-[var(--color-info)]/40',
    glow: 'from-[var(--color-info)]/18 via-[var(--color-info)]/6 to-transparent',
    badge: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
    label: 'خبر',
  },
}

/**
 * رسايل إدارة المنصة في لوحة التاجر.
 *
 * ## ليه فوق الأرقام مش تحتها
 * دي حاجة **مكسب** للتاجر — مكافأة أو تهنئة. اللي بينزل عشان يلاقيها
 * ما بيلاقيهاش، واللي ما بيلاقيهاش ما بيستفدش منها، والإدارة تفتكر
 * إن العرض ما نفعش وهو ما اتشافش أصلًا.
 *
 * ## والقفل نهائي وواضح
 * زرار X ظاهر من غير ما التاجر يدوّر عليه. الرسالة اللي مش بتتقفل
 * بتتحوّل لإعلان، والتاجر بيتعلّم يتجاهل المكان كله — بما فيه
 * الرسالة الجاية اللي كانت هتفيده.
 *
 * ## والزرار بينفّذ المكافأة مش بيوديه يدوّر عليها
 * «شهر ببلاش» بيتفعّل بالضغطة نفسها، والتاريخ الجديد بيبان مكان
 * الزرار على طول. المكافأة اللي محتاجة الطرفين يتكلّموا عشان تتفعّل
 * مش مكافأة — دي مهمة.
 */
export function NoticeCards({ notices }: { notices: MerchantNotice[] }) {
  const [hidden, setHidden] = useState<string[]>([])
  const [, start] = useTransition()

  const shown = notices.filter((n) => !hidden.includes(n.id))
  if (shown.length === 0) return null

  return (
    <div className="zw-stagger flex flex-col gap-3">
      {shown.map((n) => {
        const t = TONE[n.tone] ?? TONE.info
        const Icon = t.icon

        return (
          <article
            key={n.id}
            className={cn(
              'zw-sheet relative overflow-hidden rounded-2xl border bg-[var(--surface)] p-4 sm:p-5',
              t.ring,
            )}
          >
            {/* توهّج خفيف — بيميّزها عن كروت الأرقام من غير ما يصرخ */}
            <span
              className={cn(
                'pointer-events-none absolute inset-0 bg-gradient-to-bl',
                t.glow,
              )}
              aria-hidden="true"
            />

            <div className="relative flex flex-col gap-3">
              <div className="flex flex-wrap items-start gap-3">
                <span
                  className={cn(
                    'zw-pulse flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                    t.badge,
                  )}
                >
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>

                <div className="min-w-0 flex-1">
                  <span
                    className={cn(
                      'mb-1 inline-block rounded px-1.5 py-0.5 text-[11px] font-medium',
                      t.badge,
                    )}
                  >
                    {t.label}
                  </span>
                  <h3 className="text-base font-bold leading-snug sm:text-lg">{n.title}</h3>
                </div>

                <button
                  type="button"
                  aria-label="اقفل الرسالة"
                  onClick={() => {
                    setHidden((h) => [...h, n.id])
                    start(async () => {
                      await dismissNoticeAction(n.id)
                    })
                  }}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              {/*
                النص بيتعرض بأسطره زي ما الإدارة كتبتها.

                `whitespace-pre-line` عشان السطر الجديد يفضل سطرًا —
                الإدارة بتكتب شروطًا في نقط، ودمجها في فقرة واحدة
                بيخلّي العرض صعب القراية.
              */}
              <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--fg-muted)]">
                {n.body}
              </p>

              <NoticeAction notice={n} />
            </div>
          </article>
        )
      })}
    </div>
  )
}

/**
 * الزرار — بيختلف حسب المكافأة.
 *
 * `free_days` بيفعّل بضغطة ويقلب لتأكيد بالتاريخ، و`link` بيوديه
 * لصفحة في لوحته، و`none` مالوش زرار أصلًا (التهنئة مش محتاجة
 * إجراء).
 */
function NoticeAction({ notice }: { notice: MerchantNotice }) {
  const [pending, start] = useTransition()
  const [error, setError] = useState<string | null>(null)
  /* التاريخ الجديد أول ما يتفعّل — من غير انتظار تحديث الصفحة */
  const [until, setUntil] = useState<Date | null>(notice.redeemedUntil)

  if (until) {
    return (
      <div className="zw-sheet flex flex-wrap items-center gap-2 rounded-xl bg-[var(--color-success-soft)] px-3 py-2.5 text-sm text-[var(--color-success)]">
        <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="font-semibold">تمّت! المكافأة اتفعّلت.</span>
        {/*
          `getTime` لا صدق الوجود.

          الصف المتسجّل من غير تاريخ (مكافأة مش أيام) بيتقرا كـ
          `new Date(0)` — عرض «١ يناير ١٩٧٠» كان هيبان عطلًا.
        */}
        {until.getTime() > 0 && (
          <span className="text-[var(--fg-muted)]">
            اشتراكك ماشي لحد {formatDate(until)}
          </span>
        )}
      </div>
    )
  }

  if (notice.rewardKind === 'free_days') {
    return (
      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setError(null)
              const res = await redeemNoticeAction(notice.id)
              if (res.error) setError(res.error)
              else if (res.until) setUntil(new Date(res.until))
            })
          }
          className="flex h-11 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Gift className="h-4 w-4" aria-hidden="true" />
          )}
          {/* الرقم بأرقام اللغة — «فعّل 30 يوم» بتكسر السطر العربي بخطّين */}
          {notice.ctaLabel?.trim() || `فعّل ${formatCount(notice.rewardDays)} يوم مجاني`}
        </button>

        {error && <p className="text-sm text-[var(--color-danger)]">{error}</p>}
      </div>
    )
  }

  if (notice.rewardKind === 'link' && notice.ctaHref) {
    return (
      <Link
        href={notice.ctaHref}
        className="flex h-11 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90"
      >
        {notice.ctaLabel?.trim() || 'افتح الصفحة'}
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      </Link>
    )
  }

  return null
}
