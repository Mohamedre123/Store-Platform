'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { SLink as Link } from '../store-link'
import type { CountdownBlock } from '@/lib/blocks'

/**
 * العرض بعدّاد.
 *
 * ## ليه بالتاريخ لا بالدقايق
 * العدّاد اللي بيبدأ من أول ما العميل يفتح الصفحة بيتكشف: يعمل
 * تحديث فيلاقيه رجع من الأول، أو يفتح من موبايله بعد ساعة فيلاقي
 * نفس الساعتين. العميل اللي حسّها مزيّفة مش بس بيتجاهل العرض ده —
 * بيبطّل يصدّق أسعار المتجر كلها.
 *
 * هنا التاجر بيحدّد **لحظة انتهاء حقيقية**، فالعدّاد واحد لكل
 * العملاء وبيوصل صفر مرة واحدة.
 *
 * ## الوقت بيتحسب في المتصفح
 * الخادم بيرسم البلوك من غير أرقام، والمتصفح بيملاها. لو حسبناها
 * على الخادم كانت هتتخزّن في الكاش وتوصل للعميل التالي متأخرة
 * بدقايق — عدّاد بيعرض وقت غلط أسوأ من مفيش عدّاد.
 */

type Left = { d: number; h: number; m: number; s: number; over: boolean }

function remaining(endsAt: string, whenDone: CountdownBlock['whenDone']): Left | null {
  const end = Date.parse(endsAt)
  if (Number.isNaN(end)) return null

  let target = end
  /*
    «يعيد كل يوم»: العرض اليومي المتكرّر (زي «خصم لحد نص الليل»)
    بيتنقل لنفس الساعة بكرة بدل ما يقف على صفر للأبد.
  */
  if (whenDone === 'repeat' && end < Date.now()) {
    const day = 86_400_000
    target = end + Math.ceil((Date.now() - end) / day) * day
  }

  const diff = target - Date.now()
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, over: true }

  return {
    d: Math.floor(diff / 86_400_000),
    h: Math.floor((diff % 86_400_000) / 3_600_000),
    m: Math.floor((diff % 3_600_000) / 60_000),
    s: Math.floor((diff % 60_000) / 1000),
    over: false,
  }
}

export function CountdownBlockView({ block }: { block: CountdownBlock }) {
  const [left, setLeft] = useState<Left | null>(null)

  useEffect(() => {
    if (!block.endsAt) return

    const tick = () => setLeft(remaining(block.endsAt, block.whenDone))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [block.endsAt, block.whenDone])

  /* انتهى والتاجر طالب يختفي — البلوك بيسيب مكانه بالكامل */
  if (left?.over && block.whenDone === 'hide') return null

  const units = left
    ? [
        ...(left.d > 0 ? [{ v: left.d, l: 'يوم' }] : []),
        { v: left.h, l: 'ساعة' },
        { v: left.m, l: 'دقيقة' },
        { v: left.s, l: 'ثانية' },
      ]
    : []

  return (
    <section className="py-6 sm:py-10">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div
          className="relative flex min-h-[14rem] flex-col items-center justify-center gap-5 overflow-hidden rounded-[var(--sf-radius)] p-8 text-center sm:p-12"
          style={{ background: block.background }}
        >
          {block.image && (
            <>
              <Image src={block.image} alt="" fill sizes="100vw" className="object-cover" />
              {block.overlay > 0 && (
                <span
                  className="absolute inset-0"
                  style={{ background: `rgba(0,0,0,${block.overlay / 100})` }}
                  aria-hidden="true"
                />
              )}
            </>
          )}

          <div
            className="relative flex flex-col items-center gap-5 rounded-[var(--sf-radius)]"
            style={
              block.blur > 0
                ? {
                    backdropFilter: `blur(${block.blur}px)`,
                    WebkitBackdropFilter: `blur(${block.blur}px)`,
                    padding: '1.25rem 1.5rem',
                  }
                : undefined
            }
          >
            {block.heading && (
              <h2
                className="text-2xl font-bold tracking-tight sm:text-3xl"
                style={{ color: block.textColor, fontFamily: 'var(--sf-font-heading)' }}
              >
                {block.heading}
              </h2>
            )}
            {block.text && (
              <p className="max-w-lg text-sm sm:text-base" style={{ color: block.textColor, opacity: 0.88 }}>
                {block.text}
              </p>
            )}

            {units.length > 0 && (
              /*
                الأرقام لاتينية واتجاهها LTR: العدّاد اللي بيتقرا
                «ثانية دقيقة ساعة» بيلخبط العين — ترتيب الوقت عالمي
                حتى في نص عربي.
              */
              <div className="flex gap-2 sm:gap-3" dir="ltr">
                {units.map((u) => (
                  <div key={u.l} className="flex flex-col items-center gap-1">
                    <span
                      className="tabular flex h-14 w-14 items-center justify-center rounded-[var(--sf-radius)] bg-white/15 text-2xl font-bold backdrop-blur-sm sm:h-16 sm:w-16 sm:text-3xl"
                      style={{ color: block.textColor }}
                    >
                      {String(u.v).padStart(2, '0')}
                    </span>
                    <span className="text-xs" style={{ color: block.textColor, opacity: 0.7 }}>
                      {u.l}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/*
              مساحة محجوزة قبل ما المتصفح يحسب الوقت — من غيرها
              الصفحة بتقفز لما الأرقام تظهر.
            */}
            {!left && block.endsAt && <div className="h-[4.75rem] sm:h-[5.25rem]" aria-hidden="true" />}

            {block.ctaLabel && block.ctaUrl && (
              <Link
                href={block.ctaUrl}
                className="mt-1 inline-flex min-h-11 items-center rounded-[var(--sf-radius)] px-7 text-sm font-semibold shadow-sm transition-transform hover:scale-[1.03]"
                style={{ background: block.ctaBg || 'var(--sf-primary)', color: block.ctaColor || '#ffffff' }}
              >
                {block.ctaLabel}
              </Link>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
