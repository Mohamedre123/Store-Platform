'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Gift, PartyPopper, Sparkles, X } from 'lucide-react'
import { dismissNoticeAction } from '@/app/dashboard/notice-actions'
import type { MerchantNotice, NoticeTone } from '@/lib/notices'
import { cn } from '@/lib/utils'

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
 * ## والاختفاء متفائل
 * البطاقة بتختفي من الشاشة على طول، والكتابة في القاعدة بعدها. لو
 * فشلت، الرسالة بترجع في الفتحة الجاية — وده أهون من إن التاجر
 * يدوس ويستنى.
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

              {n.ctaLabel && n.ctaHref && (
                <Link
                  href={n.ctaHref}
                  className="flex h-11 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90"
                >
                  {n.ctaLabel}
                  <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
