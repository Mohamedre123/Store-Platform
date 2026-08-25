'use client'

import { useEffect, useRef, useState } from 'react'
import type { LandingTokens } from '@/lib/landing'

/**
 * ظهور القسم مع التمرير.
 *
 * ## ليه مراقب تقاطع لا مستمع تمرير
 * مستمع التمرير بيشتغل عشرات المرات في الثانية وبيحسب مواقع العناصر
 * في كل مرة — وده بيخلّي الصفحة تتهتّ على تليفون متوسط، وهي نفس
 * الصفحة اللي المفروض تبيع. المراقب بيسيب المتصفح يحسب وقت فراغه
 * وبيبلّغنا مرة واحدة.
 *
 * ## بيتفك بعد أول ظهور
 * الحركة بتحصل مرة. لو سبنا المراقب شغّالًا، القسم بيرجع يختفي لما
 * العميل يترمّح لفوق — والصفحة بتبقى بتومض وهو بيقرا.
 *
 * ## واللي بيقفل الحركة بيتحترم
 * `prefers-reduced-motion` مش تفضيل شكلي: فيه ناس الحركة بتسبّبلهم
 * دوخة وغثيان فعلًا. بنعرض المحتوى فورًا بلا حركة، مش بنبطّئها.
 *
 * ## والمحتوى موجود دايمًا
 * البداية `opacity: 0` مش `display: none` — القسم في الصفحة من أول
 * لحظة، فمحرّكات البحث بتقراه وقارئ الشاشة بيوصله. ولو الجافاسكربت
 * ما اشتغلش خالص، `noscript` بيلغي الإخفاء.
 */

export function LandingReveal({
  animation,
  durationMs,
  index,
  children,
}: {
  animation: LandingTokens['animation']
  durationMs: number
  /** ترتيب القسم — بيدخّل تأخيرًا بسيطًا فالأقسام ما تظهرش دفعة واحدة */
  index: number
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(animation === 'none')

  useEffect(() => {
    if (animation === 'none') return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setShown(true)
      return
    }

    const el = ref.current
    if (!el) return

    /*
      القسم اللي فوق الطيّة لازم يبان فورًا: العميل جه من إعلان،
      وأول ما الصفحة تفتح يلاقي فراغ لنص ثانية يبقى قرّر يخرج.
    */
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) {
      setShown(true)
      return
    }

    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        setShown(true)
        io.disconnect()
      },
      /* هامش سالب: القسم يبدأ يظهر وهو داخل فعلًا مش وهو لسه بيلمس الحافة */
      { rootMargin: '0px 0px -12% 0px', threshold: 0.05 },
    )

    io.observe(el)

    /*
      شبكة أمان: القسم بيتعرض بعد ثانيتين مهما حصل.

      البداية `opacity: 0` معناها إن أي حاجة تمنع المراقب من العمل
      بتسيب **صفحة بيضا** — لا رسالة خطأ ولا نص، بياض. والحالات دي
      حقيقية: تبويب اشتغل في الخلفية فالمتصفح جمّد الرسم، جهاز ضعيف
      بيخنق المؤقّتات، أو متصفح قديم بمراقب ناقص.

      صفحة بلا حركة أحسن ألف مرة من صفحة فاضية — والتاجر اللي دافع
      على إعلان مش هيعرف أصلًا إن ده بيحصل لجزء من زوّاره.
    */
    const safety = setTimeout(() => setShown(true), 2000)

    return () => {
      io.disconnect()
      clearTimeout(safety)
    }
  }, [animation])

  if (animation === 'none') return <>{children}</>

  return (
    <div
      ref={ref}
      data-lp-reveal=""
      style={{
        transitionProperty: 'opacity, transform, filter',
        transitionDuration: `${durationMs}ms`,
        transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)',
        /* التأخير بيتوقف عند حد: قسم رقم ٢٠ ما يستنّاش ثانيتين */
        transitionDelay: `${Math.min(index, 4) * 70}ms`,
        ...(shown
          ? { opacity: 1, transform: 'none', filter: 'none' }
          : hiddenStyle(animation)),
      }}
    >
      {children}
    </div>
  )
}

function hiddenStyle(animation: Exclude<LandingTokens['animation'], 'none'>): React.CSSProperties {
  switch (animation) {
    case 'fade':
      return { opacity: 0 }
    case 'rise':
      return { opacity: 0, transform: 'translateY(28px)' }
    case 'slide':
      return { opacity: 0, transform: 'translateX(-32px)' }
    case 'zoom':
      return { opacity: 0, transform: 'scale(0.94)' }
    case 'blur':
      return { opacity: 0, filter: 'blur(10px)' }
  }
}

/**
 * شبكة أمان للجافاسكربت المقفول.
 *
 * لو السكربت ما وصلش (شبكة وقعت، متصفح قافله)، الأقسام بتفضل
 * `opacity: 0` والصفحة بتبان فاضية تمامًا. السطر ده بيلغي الإخفاء
 * كله ساعتها — صفحة بلا حركة أحسن من صفحة بيضا.
 */
export function RevealFallback() {
  return (
    <noscript>
      <style>{`[data-lp-reveal]{opacity:1!important;transform:none!important;filter:none!important}`}</style>
    </noscript>
  )
}
