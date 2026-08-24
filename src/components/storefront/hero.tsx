'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { SLink as Link } from './store-link'
import type { HeroDraft } from '@/lib/storefront'

/**
 * البانر الرئيسي.
 *
 * بيعرض شرائح التاجر بصورها ونصوصها، وبيتنقّل بينها تلقائيًا لو
 * أكتر من واحدة. لو مافيش شرائح، بيرجع لبانر باسم المتجر ووصفه
 * بدل ما يسيب أول الصفحة فاضي.
 *
 * صورة الموبايل منفصلة عن الكمبيوتر: صورة عريضة على شاشة طولية
 * بتتقص من الجناب وبيضيع نصها.
 */

const HEIGHTS = {
  sm: 'min-h-[34vh]',
  md: 'min-h-[46vh]',
  lg: 'min-h-[62vh]',
  full: 'min-h-[86vh]',
} as const

export function Hero({
  hero,
  storeName,
  tagline,
  fallbackStyle,
}: {
  hero: HeroDraft | undefined
  storeName: string
  tagline: string | null
  fallbackStyle: 'fullbleed' | 'boxed' | 'split' | 'stacked' | 'none'
}) {
  const style = hero?.style ?? fallbackStyle
  const slides = hero?.slides ?? []
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (!hero?.autoplay || slides.length < 2) return
    const ms = Math.max(3, hero.intervalSeconds ?? 6) * 1000
    const id = setInterval(() => setIndex((i) => (i + 1) % slides.length), ms)
    return () => clearInterval(id)
  }, [hero?.autoplay, hero?.intervalSeconds, slides.length])

  if (style === 'none') return null

  const height = HEIGHTS[hero?.height ?? 'md']
  const active = slides[index]
  const hasImage = Boolean(active?.imageDesktop || active?.imageMobile)

  /**
   * **بنعرض اللي التاجر كتبه بالظبط — ولا كلمة زيادة.**
   *
   * كان فيه احتياطي على كل خانة: العنوان الفاضي بياخد اسم المتجر،
   * والوصف الفاضي بياخد «اطلب دلوقتي والتوصيل لباب البيت». فالتاجر
   * يكتب عنوانه، ويفتح متجره، ويلاقي تحته جملة مكتوبة مش من عنده —
   * ويفضل يدوّر على مكان يمسحها منه وما فيش.
   *
   * الاحتياطي ده كان معمول لحالة واحدة: متجر لسه ما ظبّطش بانره
   * خالص، عشان أول الصفحة ما يبقاش مربّعًا ملوّنًا فاضي. فبيتحصر
   * فيها: شريحة فيها أي محتوى بتتعرض زي ما هي.
   */
  const typed = {
    title: active?.title?.trim() ?? '',
    subtitle: active?.subtitle?.trim() ?? '',
    cta: active?.ctaLabel?.trim() ?? '',
  }

  /* شريحة «فاضية» = لا صورة ولا كلام ولا زر — يبقى مافيش بانر أصلًا */
  const blank = !hasImage && !typed.title && !typed.subtitle && !typed.cta

  const title = blank ? storeName : typed.title
  const subtitle = blank ? tagline || 'اطلب دلوقتي والتوصيل لباب البيت' : typed.subtitle
  const ctaLabel = blank ? 'تسوّق دلوقتي' : typed.cta
  const ctaUrl = active?.ctaUrl || '/products'

  const showText = Boolean(title || subtitle)
  const showCta = Boolean(ctaLabel)

  /**
   * الضبابية اختيار صريح.
   *
   * كانت رقمًا، والتاجر اللي عايز يجرّبها ويرجع لازم يفتكر إنها كانت
   * صفر. المفتاح بيقول «شغّالة ولا لأ» من نظرة، والشدّة بتبان لما
   * يشغّلها بس.
   */
  const blur = active?.blurEnabled === false ? 0 : (active?.blur ?? 0)
  const textColor = active?.textColor || '#ffffff'

  const align =
    active?.textPosition === 'center'
      ? 'items-center text-center'
      : active?.textPosition === 'end'
        ? 'items-end text-end'
        : 'items-start text-start'

  const cta = (
    <Link
      href={ctaUrl}
      className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-[var(--sf-radius)] px-6 font-semibold shadow-sm transition-opacity hover:opacity-90"
      style={{
        background: active?.ctaBg || '#ffffff',
        color: active?.ctaColor || 'var(--sf-primary)',
      }}
    >
      {ctaLabel}
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
    </Link>
  )

  /* بانر نصين — نص جنب صورة */
  if (style === 'split') {
    return (
      <section data-sf="hero" className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          {title && <h1 className="text-balance text-3xl font-bold tracking-tight sm:text-5xl">{title}</h1>}
          {subtitle && <p className="text-lg opacity-70">{subtitle}</p>}
          {showCta && (
          <Link
            href={ctaUrl}
            className="mt-2 inline-flex min-h-12 w-fit items-center gap-2 rounded-[var(--sf-radius)] px-6 font-semibold shadow-sm transition-opacity hover:opacity-90"
            style={{
              background: active?.ctaBg || 'var(--sf-primary)',
              color: active?.ctaColor || '#ffffff',
            }}
          >
            {ctaLabel}
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
          )}
        </div>
        <div className="relative aspect-[4/3] overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-primary)]">
          {active?.imageDesktop && (
            <Image src={active.imageDesktop} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" priority />
          )}
        </div>
      </section>
    )
  }

  const inner = (
    <div
      className={`relative flex ${height} flex-col justify-center gap-4 overflow-hidden px-6 py-14 sm:px-10 ${align} ${
        style === 'boxed' || style === 'stacked' ? 'rounded-[var(--sf-radius)]' : ''
      }`}
      style={{ background: 'var(--sf-primary)' }}
    >
      {active?.imageDesktop && (
        <Image
          src={active.imageDesktop}
          alt=""
          fill
          priority
          sizes="100vw"
          className="hidden object-cover sm:block"
        />
      )}
      {(active?.imageMobile || active?.imageDesktop) && (
        <Image
          src={active.imageMobile || active.imageDesktop!}
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover sm:hidden"
        />
      )}

      {/* التعتيم بيشتغل للزر زي النص — الزر الأبيض على صورة فاتحة بيختفي */}
      {hasImage && (showText || showCta) && (
        <span
          className="absolute inset-0 bg-black"
          style={{ opacity: (active?.overlay ?? 35) / 100 }}
          aria-hidden="true"
        />
      )}

      {(showText || showCta) && (
        <div className={`relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4 ${align}`}>
          <div
            className={`flex flex-col gap-4 rounded-[var(--sf-radius)] ${align}`}
            style={
              blur > 0
                ? {
                    /*
                      الضبابية خلف النص والزر بس، مش على الصورة كلها:
                      كده الزر يبان والصورة تفضل واضحة — الضبابية على
                      الصورة كلها بتضيّع اللي التاجر رفعها عشانه.
                    */
                    backdropFilter: `blur(${blur}px)`,
                    WebkitBackdropFilter: `blur(${blur}px)`,
                    /*
                      طبقة خفيفة مع الضبابية.
                      الضبابية وحدها بتبان باهتة فوق صورة هادية —
                      الطبقة بتدّي النص أرضية يقف عليها.
                    */
                    background: 'rgba(0,0,0,0.28)',
                    padding: '1.25rem 1.5rem',
                  }
                : undefined
            }
          >
            {title && (
              <h1
                className="text-balance text-3xl font-bold tracking-tight sm:text-5xl"
                style={{ color: textColor }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p className="max-w-lg" style={{ color: textColor, opacity: 0.85 }}>
                {subtitle}
              </p>
            )}
            {showCta && cta}
          </div>
        </div>
      )}

      {/* الصورة وحدها قابلة للضغط لو مافيش نص ولا زر فوقها */}
      {hasImage && !showText && !showCta && (
        <Link href={ctaUrl} className="absolute inset-0 z-10" aria-label={ctaLabel} />
      )}

      {slides.length > 1 && (
        <div className="absolute inset-x-0 bottom-4 z-10 flex justify-center gap-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`الشريحة ${i + 1}`}
              className={`h-2 rounded-full transition-all ${i === index ? 'w-6 bg-white' : 'w-2 bg-white/50'}`}
            />
          ))}
        </div>
      )}
    </div>
  )

  if (style === 'fullbleed') {
    return (
      <section data-sf="hero">
        {inner}
      </section>
    )
  }

  return (
    <section data-sf="hero" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      {inner}
    </section>
  )
}
