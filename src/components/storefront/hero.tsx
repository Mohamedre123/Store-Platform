'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import { ArrowLeft } from 'lucide-react'
import { SLink as Link } from './store-link'
import { hexToRgba } from '@/lib/utils'
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

/**
 * ارتفاع البانر — **نسبة على الفون، وارتفاع شاشة على الكمبيوتر**.
 *
 * ## المشكلة
 * الارتفاع كان `vh` على الاتنين. و`46vh` على شاشة كمبيوتر عريضة بتدّي
 * بانرًا أفقيًا مظبوط، وعلى فون بتدّي شريطًا **عرضه ضعف طوله** — والصورة
 * الطولية اللي التاجر رفعها بتتقص من فوق وتحت وما يبانش منها غير وسطها.
 *
 * ## الحل
 * على الفون الارتفاع بيتحسب من **العرض** لا من الشاشة: `125vw` معناها
 * الطول مرة وربع العرض، يعني نسبة ٤:٥ طولية. البانر بيبقى ليه نفس شكل
 * الصورة اللي جواه بدل ما يقصّها.
 *
 * والقياسات دي تحت ٦٤٠ بكسل بس (`sm:` بتقلبها لارتفاع شاشة)، فالتابلت
 * والكمبيوتر ما اتغيّرش فيهم حاجة.
 *
 * `svh` في «ملء الشاشة» لا `vh`: على الموبايل `vh` بتحسب الشاشة من غير
 * شريط المتصفح، فالبانر بيطلع أطول من المتاح ويتقص آخره.
 */
const HEIGHTS = {
  sm: 'min-h-[min(100vw,72svh)] sm:min-h-[34vh]',
  md: 'min-h-[min(125vw,80svh)] sm:min-h-[46vh]',
  lg: 'min-h-[min(150vw,88svh)] sm:min-h-[62vh]',
  full: 'min-h-[88svh] sm:min-h-[86vh]',
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
  const subtitleColor = active?.subtitleColor || textColor

  /**
   * مقاسات الكلام.
   *
   * كل مقاس سطرين: واحد للفون وواحد للكمبيوتر. الحجم الواحد اللي
   * بيتكبّر بالشاشة بس كان بيدّي عنوانًا مزنوقًا على الفون أو تايهًا
   * على الكمبيوتر — والفرق بينهم مش نسبة ثابتة.
   */
  const TITLE_SIZE = {
    sm: 'text-xl sm:text-3xl',
    md: 'text-3xl sm:text-5xl',
    lg: 'text-4xl sm:text-6xl',
    xl: 'text-5xl sm:text-7xl',
  } as const

  const SUBTITLE_SIZE = {
    sm: 'text-sm sm:text-base',
    md: 'text-base sm:text-lg',
    lg: 'text-lg sm:text-2xl',
  } as const

  const titleClass = TITLE_SIZE[active?.titleSize ?? 'md']
  const subtitleClass = SUBTITLE_SIZE[active?.subtitleSize ?? 'md']
  const titleFamily =
    active?.titleFont === 'body' ? 'var(--sf-font-body)' : 'var(--sf-font-heading)'

  const align =
    active?.textPosition === 'center'
      ? 'items-center text-center'
      : active?.textPosition === 'end'
        ? 'items-end text-end'
        : 'items-start text-start'

  /**
   * الزر الزجاجي.
   *
   * شفاف بضبابية وحدّ فاتح بدل اللون المصمت — بيقعد فوق الصورة من غير
   * ما يقطعها. لونه بيتبع لون النص عشان يفضل مقروءًا على أي صورة.
   *
   * `WebkitBackdropFilter` جنب القياسي: سفاري بيدعم الضبابية بالبادئة
   * بس، ومن غيرها الزر بيبان مستطيلًا شفافًا بلا أي تأثير على آيفون —
   * وده نص عملاء المتاجر هنا.
   */
  const glassCta = active?.ctaStyle === 'glass'

  const cta = (
    <Link
      href={ctaUrl}
      className="mt-2 inline-flex min-h-12 items-center gap-2 rounded-[var(--sf-radius)] px-6 font-semibold shadow-sm transition-opacity hover:opacity-90"
      style={
        glassCta
          ? {
              background: 'rgba(255,255,255,0.16)',
              backdropFilter: 'blur(14px)',
              WebkitBackdropFilter: 'blur(14px)',
              border: '1px solid rgba(255,255,255,0.38)',
              color: active?.ctaColor || textColor,
            }
          : {
              background: active?.ctaBg || '#ffffff',
              color: active?.ctaColor || 'var(--sf-primary)',
            }
      }
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
          {/*
            نفس مقاسات الكلام بتاعة باقي الأنماط.

            اللون هنا **مش** من إعداد الشريحة: الكلام في النمط ده قاعد
            على خلفية المتجر لا على صورة، فلون أبيض مختار عشان يبان فوق
            صورة غامقة بيختفي هنا خالص.
          */}
          {title && (
            <h1
              className={`text-balance font-bold tracking-tight ${titleClass}`}
              style={{ fontFamily: titleFamily }}
            >
              {title}
            </h1>
          )}
          {subtitle && (
            <p className={`text-pretty leading-relaxed opacity-70 ${subtitleClass}`}>{subtitle}</p>
          )}
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
          {/*
            حدّ العرض على الكلام في الحالتين — باللوح ومن غيره.

            كان على الوصف وحده (`max-w-lg`)، فالعنوان الطويل بيمتد على
            عرض البانر كله والوصف تحته نُصّه — وشكلهم مايوصلش لبعض.
          */}
          <div
            className={`flex max-w-[34rem] flex-col gap-4 rounded-[var(--sf-radius)] ${align}`}
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
                    background: hexToRgba(active?.panelTint || '#000000', active?.panelOpacity ?? 28),
                    /*
                      حدّ فاتح وظل — دول اللي بيخلّوا اللوح يبان **لوحًا**
                      قاعد فوق الصورة، مش بقعة غامقة متغسّلة فيها. الحدّ
                      بيرسم الحافة والظل بيفصلها عن اللي وراها.
                    */
                    border: '1px solid rgba(255,255,255,0.16)',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
                    padding: '1.5rem 1.75rem',
                    /*
                      اللوح ما ياخدش عرض البانر كله.

                      السطر اللي بيمتد على عرض الشاشة صعب تتبعه بالعين،
                      والقياس المتعارف عليه حوالي ٦٥ حرفًا. من غير الحد
                      ده اللوح كان بيبقى شريطًا عريضًا فيه سطر واحد.
                    */
                    maxWidth: 'min(100%, 34rem)',
                  }
                : undefined
            }
          >
            {title && (
              <h1
                className={`text-balance font-bold tracking-tight ${titleClass}`}
                style={{
                  color: textColor,
                  fontFamily: titleFamily,
                  /*
                    ظل خفيف تحت الكلام.

                    الصورة اللي فيها منطقة فاتحة بتبلع الحرف الأبيض عندها
                    حتى واللوح شغّال — والتاجر بيزوّد التعتيم عشان يقراه،
                    فيغمّق صورته كلها عشان كلمة. الظل بيحل ده من غير ما
                    يلمس الصورة.
                  */
                  textShadow: '0 1px 12px rgba(0,0,0,0.28)',
                }}
              >
                {title}
              </h1>
            )}
            {subtitle && (
              <p
                className={`text-pretty leading-relaxed ${subtitleClass}`}
                style={{
                  color: subtitleColor,
                  opacity: 0.92,
                  textShadow: '0 1px 10px rgba(0,0,0,0.24)',
                }}
              >
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
