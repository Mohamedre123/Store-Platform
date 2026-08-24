'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { SLink as Link } from '../store-link'
import type { SlideItem, SlidesBlock } from '@/lib/blocks'

/**
 * بلوك الشرائح.
 *
 * مبني على **تمرير المتصفح نفسه** (`scroll-snap`) مش على تحريك
 * `transform` بجافاسكربت. الفرق مش تقني: مع التمرير الأصلي العميل
 * بيسحب بصباعه ويلاقيها بتمشي معاه لحظة بلحظة، والسحب النصّي بيرجع
 * لمكانه. المكتبات اللي بتقلّد التمرير بتتأخّر إطار أو اتنين على
 * موبايل ضعيف، وده اللي بيخلّي الشريحة تبان «تقيلة».
 *
 * ولو جافاسكربت وقع، الشرائح تفضل قابلة للتصفّح بالسحب — الأسهم
 * والنقط هي اللي بتروح، مش المحتوى.
 */

const HEIGHT: Record<SlidesBlock['height'], string> = {
  sm: 'h-[12rem] sm:h-[16rem]',
  md: 'h-[16rem] sm:h-[24rem]',
  lg: 'h-[20rem] sm:h-[32rem]',
  full: 'h-[calc(100svh-4rem)]',
}

const POSITION: Record<SlideItem['textPosition'], string> = {
  start: 'justify-start text-start',
  center: 'justify-center text-center',
  end: 'justify-end text-start',
}

export function SlidesBlockView({ block }: { block: SlidesBlock }) {
  const items = block.items.filter((s) => s.imageDesktop || s.imageMobile || s.heading)
  const railRef = useRef<HTMLDivElement>(null)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)

  const goTo = useCallback((index: number) => {
    const rail = railRef.current
    if (!rail) return
    const child = rail.children[index] as HTMLElement | undefined
    if (!child) return
    /*
      `scrollTo` بالإزاحة لا `scrollIntoView`: التانية بتحرّك الصفحة
      كلها كمان عشان توصّل العنصر للشاشة، فالمستخدم بيلاقي الصفحة
      قفزت وهو بس ضغط سهم.
    */
    rail.scrollTo({ left: child.offsetLeft - rail.offsetLeft, behavior: 'smooth' })
  }, [])

  /* الشريحة النشطة بتتحدّد من مكان التمرير الفعلي لا من عدّاد عندنا */
  useEffect(() => {
    const rail = railRef.current
    if (!rail || items.length < 2) return

    let frame = 0
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const width = rail.clientWidth || 1
        setActive(Math.round(Math.abs(rail.scrollLeft) / width))
      })
    }

    rail.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      rail.removeEventListener('scroll', onScroll)
    }
  }, [items.length])

  /* التبديل التلقائي — بيقف لما العميل يلمس أو يمرّر عليها */
  useEffect(() => {
    if (!block.autoplay || paused || items.length < 2) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const id = setInterval(
      () => goTo((active + 1) % items.length),
      Math.max(2, block.intervalSeconds) * 1000,
    )
    return () => clearInterval(id)
  }, [block.autoplay, block.intervalSeconds, active, items.length, paused, goTo])

  if (items.length === 0) return null

  return (
    <section
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      aria-roledescription="carousel"
    >
      <div
        ref={railRef}
        className={`scroll-x flex snap-x snap-mandatory ${HEIGHT[block.height]}`}
      >
        {items.map((item, i) => (
          <Slide key={item.id} item={item} index={i} total={items.length} />
        ))}
      </div>

      {items.length > 1 && block.showArrows && (
        <>
          <Arrow side="start" onClick={() => goTo((active - 1 + items.length) % items.length)} />
          <Arrow side="end" onClick={() => goTo((active + 1) % items.length)} />
        </>
      )}

      {items.length > 1 && block.showDots && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center gap-2">
          {items.map((item, i) => (
            <button
              key={item.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`شريحة ${i + 1}`}
              aria-current={i === active}
              className={`h-2 rounded-full transition-all ${
                i === active ? 'w-6 bg-white' : 'w-2 bg-white/55 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function Slide({ item, index, total }: { item: SlideItem; index: number; total: number }) {
  const desktop = item.imageDesktop ?? item.imageMobile
  const mobile = item.imageMobile ?? item.imageDesktop

  const body = (
    <>
      {desktop && (
        <picture>
          {mobile && <source media="(max-width: 639px)" srcSet={mobile} />}
          <Image
            src={desktop}
            alt={item.heading || ''}
            fill
            sizes="100vw"
            className="object-cover"
            /* أول شريحة بس بتتحمّل بأولوية — هي اللي العميل بيشوفها */
            priority={index === 0}
          />
        </picture>
      )}

      {desktop && item.overlay > 0 && (
        <span
          className="absolute inset-0"
          style={{ background: `rgba(0,0,0,${item.overlay / 100})` }}
          aria-hidden="true"
        />
      )}

      <span className={`relative flex h-full items-center px-6 sm:px-14 ${POSITION[item.textPosition]}`}>
        <span
          className="flex max-w-xl flex-col gap-3 rounded-[var(--sf-radius)]"
          style={
            item.blur > 0
              ? {
                  backdropFilter: `blur(${item.blur}px)`,
                  WebkitBackdropFilter: `blur(${item.blur}px)`,
                  background: 'rgba(0,0,0,0.16)',
                  padding: '1.25rem 1.5rem',
                }
              : undefined
          }
        >
          {item.heading && (
            <span
              className="text-2xl font-bold leading-tight sm:text-4xl"
              style={{ color: item.textColor, fontFamily: 'var(--sf-font-heading)' }}
            >
              {item.heading}
            </span>
          )}
          {item.text && (
            <span className="text-sm sm:text-lg" style={{ color: item.textColor, opacity: 0.92 }}>
              {item.text}
            </span>
          )}
          {item.ctaLabel && (
            <span
              className="mt-1 inline-flex w-fit items-center rounded-[var(--sf-radius)] px-6 py-3 text-sm font-semibold shadow-sm"
              style={{ background: item.ctaBg || 'var(--sf-primary)', color: item.ctaColor || '#ffffff' }}
            >
              {item.ctaLabel}
            </span>
          )}
        </span>
      </span>
    </>
  )

  const shell = 'relative w-full shrink-0 snap-start overflow-hidden bg-[var(--sf-text)]/6'
  const label = { 'aria-label': `${index + 1} من ${total}`, role: 'group' as const }

  if (item.ctaUrl) {
    return (
      <Link href={item.ctaUrl} className={shell} {...label}>
        {body}
      </Link>
    )
  }

  return (
    <div className={shell} {...label}>
      {body}
    </div>
  )
}

function Arrow({ side, onClick }: { side: 'start' | 'end'; onClick: () => void }) {
  /* السهم بيشاور ناحية الحركة الفعلية — في RTL «التالي» على الشمال */
  const Icon = side === 'start' ? ChevronRight : ChevronLeft

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={side === 'start' ? 'السابق' : 'التالي'}
      className={`absolute top-1/2 hidden h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-black shadow-md backdrop-blur transition-colors hover:bg-white sm:flex ${
        side === 'start' ? 'start-4' : 'end-4'
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  )
}
