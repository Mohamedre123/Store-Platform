'use client'

import Link from 'next/link'
import { ArrowLeft, Check, Sparkles, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SetupStep = {
  key: string
  label: string
  hint: string
  href: string
  done: boolean
  icon: LucideIcon
}

/**
 * دليل تجهيز المتجر.
 *
 * ## خطوة واحدة قدامه لا تمانية
 * قايمة بتمن خطوة بتخلّي التاجر الجديد يبصّ ويقفل. الخطوة الجاية
 * بتاخد الكارت كله ومعاها زرار، والباقي شرايط صغيرة تحتها — فهو
 * عارف يعمل إيه دلوقتي، وشايف الطريق فاضل قد إيه.
 *
 * ## والترتيب بترتيب الاحتياج
 * منتج، فشحن، فدفع، فنشر. مش أبجدي ولا بترتيب الشاشات — ده الترتيب
 * اللي المتجر بيشتغل بيه فعلًا: من غير منتج مفيش حاجة تتشحن، ومن
 * غير شحن مفيش سعر يتحسب.
 *
 * ## وبيختفي لما يخلص
 * الكارت ده بيتشال بالكامل بعد آخر خطوة. لو فضل، التاجر الشغّال
 * بيشوف «مبروك خلصت» كل يوم لسنة.
 */
export function SetupGuide({ steps }: { steps: SetupStep[] }) {
  const doneCount = steps.filter((s) => s.done).length
  const next = steps.find((s) => !s.done)

  if (!next) return null

  const rest = steps.filter((s) => !s.done && s.key !== next.key)
  const pct = Math.round((doneCount / steps.length) * 100)
  const NextIcon = next.icon

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] p-5 sm:p-6',
        /* تدرّج خفيف بلون الهوية — بيميّز الكارت من غير ما يصرخ */
        'bg-gradient-to-bl from-[var(--primary-soft)] via-[var(--surface)] to-[var(--surface)]',
      )}
    >
      {/*
        هالة اللون في الركن.

        `aria-hidden` و`pointer-events-none`: دي زخرفة صافية، وما
        يصحّش تتقرا لمستخدم القارئ الصوتي ولا تعترض ضغطة.
      */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 h-56 w-56 rounded-full bg-[var(--primary)] opacity-[0.07] blur-3xl end-[-3rem]"
      />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-[var(--primary)] px-2.5 py-1 text-[11px] font-semibold text-[var(--primary-fg)]">
              <Sparkles className="h-3 w-3" aria-hidden="true" />
              دليل الإعداد
            </span>
            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
              لنجهّز متجرك للانطلاق
            </h2>
            <p className="text-sm text-[var(--fg-muted)]">
              فاضل {steps.length - doneCount} خطوة وتبقى جاهز تستقبل أول طلب.
            </p>
          </div>

          <div className="flex min-w-[9rem] flex-1 flex-col gap-1.5 sm:max-w-[14rem]">
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-[var(--fg-muted)]">التقدّم</span>
              <span className="tabular font-semibold">
                {doneCount}/{steps.length}
              </span>
            </div>
            <span className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
              <span
                className="block h-full rounded-full bg-[var(--primary)] transition-[width] duration-700 ease-out motion-reduce:transition-none"
                style={{ width: `${pct}%` }}
              />
            </span>
          </div>
        </div>

        {/* الخطوة الجاية — واحدة بس، ومعاها زرار */}
        <Link
          href={next.href}
          className="group flex flex-wrap items-center gap-4 rounded-xl border border-[var(--primary)] bg-[var(--surface)] p-4 transition-shadow hover:shadow-md"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-fg)]">
            <NextIcon className="h-5 w-5" aria-hidden="true" />
          </span>

          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-semibold text-[var(--primary)]">
              الخطوة التالية
            </span>
            <span className="block truncate font-semibold">{next.label}</span>
            <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">{next.hint}</span>
          </span>

          <span className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)]">
            ابدأ الخطوة
            <ArrowLeft
              className="h-4 w-4 transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </span>
        </Link>

        {/* الباقي — شرايط صغيرة */}
        {rest.length > 0 && (
          <ul className="scroll-x flex gap-2 pb-1 sm:grid sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((s) => (
              <li key={s.key} className="shrink-0 basis-[70%] sm:basis-auto">
                <Link
                  href={s.href}
                  className="flex h-full items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm transition-colors hover:bg-[var(--surface-2)]"
                >
                  <s.icon
                    className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">{s.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {/* اللي خلص — أسماء بس، عشان يشوف إنه ماشي */}
        {doneCount > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {steps
              .filter((s) => s.done)
              .map((s) => (
                <li
                  key={s.key}
                  className="flex items-center gap-1.5 text-xs text-[var(--fg-subtle)]"
                >
                  <Check
                    className="h-3.5 w-3.5 shrink-0 text-[var(--color-success)]"
                    aria-hidden="true"
                  />
                  {s.label}
                </li>
              ))}
          </ul>
        )}
      </div>
    </section>
  )
}
