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

  /* `auto` مالهاش ارتفاع ثابت — الصورة هي اللي بتحدّده */
  const height = HEIGHTS[(hero?.height ?? 'md') as keyof typeof HEIGHTS] ?? HEIGHTS.md
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

  /**
   * اللوح الزجاجي — بـCSS مولّد لا بأنماط مكتوبة على العنصر.
   *
   * ## ليه
   * التاجر بيقدر يشغّل اللوح على الفون بس أو الكمبيوتر بس. والأنماط
   * المكتوبة على العنصر مالهاش استعلام وسائط — يعني الفصل ده مستحيل
   * بيها. البديل كان نرسم العنصر مرتين (واحد للفون وواحد للكمبيوتر)،
   * وساعتها العنوان بيتكرر في الصفحة مرتين ومحرّكات البحث بتقراه كده.
   *
   * فبنولّد قاعدة CSS باسم فريد للشريحة، ونلفّها في استعلام الوسائط
   * المناسب. عنصر واحد، وسلوك مختلف لكل شاشة.
   *
   * ## والقيم آمنة
   * كلها مولّدة عندنا: `hexToRgba` بترجّع أرقامًا، والضبابية رقم
   * محصور، والباقي ثوابت مكتوبة هنا. واسم الصنف بيتنضّف من أي حرف
   * برّه الحروف والأرقام — فمفيش أي نص من التاجر بيوصل للـCSS زي ما هو.
   */
  const panelId = (active?.id ?? 'x').replace(/[^a-zA-Z0-9_-]/g, '') || 'x'
  const panelClass = `zw-hero-panel-${panelId}`

  const panelRules = [
    `backdrop-filter:blur(${blur}px)`,
    `-webkit-backdrop-filter:blur(${blur}px)`,
    `background:${hexToRgba(active?.panelTint || '#000000', active?.panelOpacity ?? 28)}`,
    /* حدّ فاتح وظل — بيخلّوه يبان لوحًا قاعد فوق الصورة مش بقعة فيها */
    'border:1px solid rgba(255,255,255,0.16)',
    'box-shadow:0 8px 32px rgba(0,0,0,0.18)',
    /* مساحة أوسع جوّه اللوح — الكلام المزنوق في حوافه بيبان مضغوطًا */
    'padding:1.75rem 2rem',
  ].join(';')

  const scope = active?.panelScope ?? 'both'
  const panelCss =
    blur > 0
      ? scope === 'mobile'
        ? `@media (max-width:639.98px){.${panelClass}{${panelRules}}}`
        : scope === 'desktop'
          ? `@media (min-width:640px){.${panelClass}{${panelRules}}}`
          : `.${panelClass}{${panelRules}}`
      : ''

  const eyebrow = active?.eyebrow?.trim() ?? ''

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

  /* الكبسولة شكل الأزرار في البانرات الجاهزة — وبتبان أنضف فوق صورة */
  const ctaRadius = active?.ctaShape === 'pill' ? 'rounded-full' : 'rounded-[var(--sf-radius)]'

  const cta = (
    <Link
      href={ctaUrl}
      className={`inline-flex min-h-12 items-center gap-2 ${ctaRadius} px-7 font-semibold shadow-sm transition-opacity hover:opacity-90`}
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

  /**
   * وضع «على مقاس الصورة».
   *
   * الصورة بتتعرض في مجرى الصفحة (`h-auto`) لا كطبقة مالية للكادر،
   * فارتفاع البانر بيطلع من الصورة نفسها ومفيش أي قص. والكلام بيتحط
   * فوقها بالمطلق بدل ما يزقّها.
   *
   * `width={0} height={0}` مع `sizes` هي الطريقة اللي Next بيوفّرها
   * للصورة اللي مقاسها مش معروف وقت البناء — بيسيب المتصفح يحسبه من
   * الصورة نفسها بعد ما تنزل.
   */
  const autoSize = hero?.height === 'auto'

  const media = autoSize ? (
    <>
      {active?.imageDesktop && (
        <Image
          src={active.imageDesktop}
          alt=""
          width={0}
          height={0}
          priority
          sizes="100vw"
          className="hidden h-auto w-full sm:block"
        />
      )}
      {(active?.imageMobile || active?.imageDesktop) && (
        <Image
          src={active.imageMobile || active.imageDesktop!}
          alt=""
          width={0}
          height={0}
          priority
          sizes="100vw"
          className="h-auto w-full sm:hidden"
        />
      )}
    </>
  ) : (
    <>
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
    </>
  )

  const inner = (
    <div
      className={`relative overflow-hidden ${
        autoSize
          ? ''
          : `flex ${height} flex-col justify-center px-6 py-14 sm:px-10 ${align}`
      } ${style === 'boxed' || style === 'stacked' ? 'rounded-[var(--sf-radius)]' : ''}`}
      style={{ background: 'var(--sf-primary)' }}
    >
      {panelCss && <style dangerouslySetInnerHTML={{ __html: panelCss }} />}
      {media}

      {/* التعتيم بيشتغل للزر زي النص — الزر الأبيض على صورة فاتحة بيختفي */}
      {hasImage && (showText || showCta) && (
        <span
          className="absolute inset-0 bg-black"
          style={{ opacity: (active?.overlay ?? 35) / 100 }}
          aria-hidden="true"
        />
      )}

      {(showText || showCta) && (
        <div
          className={`z-10 mx-auto flex w-full max-w-6xl flex-col ${align} ${
            autoSize
              ? 'absolute inset-0 justify-center px-6 py-10 sm:px-10'
              : 'relative'
          }`}
        >
          {/*
            حدّ العرض على الكلام في الحالتين — باللوح ومن غيره.

            كان على الوصف وحده (`max-w-lg`)، فالعنوان الطويل بيمتد على
            عرض البانر كله والوصف تحته نُصّه — وشكلهم مايوصلش لبعض.
          */}
          {/*
            عرض اللوح محدود دايمًا — باللوح أو من غيره.

            السطر اللي بيمتد على عرض الشاشة صعب تتبعه بالعين، والقياس
            المتعارف عليه حوالي ٦٥ حرفًا. من غير الحد ده اللوح بيبقى
            شريطًا عريضًا فيه سطر واحد.
          */}
          <div className={`flex max-w-[38rem] flex-col rounded-[var(--sf-radius)] ${align} ${panelClass}`}>
            {/*
              سطر التعريف فوق العنوان.

              صغير ومتباعد الحروف — بيدّي الكلام تسلسلًا: سطر يعرّف،
              وعنوان يقول، ووصف يشرح. من غيره العنوان بيبقى معلّقًا
              لوحده في نص الصورة.
            */}
            {eyebrow && (
              <span
                className="mb-2 text-[11px] font-semibold uppercase tracking-[0.22em] sm:text-xs" dir="auto"
                style={{
                  color: active?.eyebrowColor || textColor,
                  opacity: 0.9,
                  textShadow: '0 1px 8px rgba(0,0,0,0.3)',
                }}
              >
                {eyebrow}
              </span>
            )}
            {title && (
              <h1
                dir="auto"
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
                dir="auto"
                className={`mt-3 text-pretty leading-relaxed ${subtitleClass}`}
                style={{
                  color: subtitleColor,
                  opacity: 0.92,
                  textShadow: '0 1px 10px rgba(0,0,0,0.24)',
                }}
              >
                {subtitle}
              </p>
            )}
            {showCta && <span className="mt-6">{cta}</span>}
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
