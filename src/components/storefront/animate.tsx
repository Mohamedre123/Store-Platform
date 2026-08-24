'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { ScrollAnimation } from '@/lib/customization'

/**
 * ظهور البلوك مع التمرير — بالحركة اللي التاجر اختارها.
 *
 * نفس منطق `Reveal` بتاع اللوحة، بفرقين:
 *  1. نوع الحركة وسرعتها بيجوا من إعدادات المتجر لا مكتوبين في الكود.
 *  2. العناصر جوّه البلوك بتقدر تظهر ورا بعض (`index`).
 *
 * **واللي ظاهر على الشاشة خلاص بيتعرض فورًا من غير حركة.** ده أهم
 * سطر هنا: من غيره الخادم بيرسم المحتوى ظاهر، وأول ما React يشتغل
 * بيختفي كله ويرجع واحد واحد — فالعميل يشوف الصفحة بتلعب ويفتكر
 * المتجر باظ.
 */

const useIso = typeof window === 'undefined' ? useEffect : useLayoutEffect

const DURATION: Record<'slow' | 'normal' | 'fast', number> = {
  slow: 1000,
  normal: 700,
  fast: 420,
}

/* ────────────────────────── شبكة الأمان ────────────────────────── */

/**
 * كشف احتياطي لأي عنصر لسه مستني.
 *
 * `IntersectionObserver` بيبلّغ لما العنصر **يعدّي** حدّ الشاشة. فيه
 * حالات ما بيحصلش فيها عبور أصلًا:
 *  - قفزة فورية لجزء بعيد من الصفحة (رابط داخلي والتمرير الناعم مقفول).
 *  - التبويب اتفتح في الخلفية: الصفحة ما بترسمش، فالمراقب ما بيبلّغش.
 *
 * في الحالتين العنصر بيفضل شفافًا للأبد — يعني **محتوى المتجر يختفي**،
 * وهو أصلًا اتبعت من الخادم كامل. ده مش عيب شكلي، ده منتجات مش
 * ظاهرة للعميل.
 *
 * فبنمسح المستنيين كل ٢٥٠ ملّي وقت التمرير بس، ونشيل المستمع أول ما
 * القايمة تفضى. القياس بيتعمل للمستنيين لوحدهم — وعددهم بيقلّ مع كل
 * تمريرة لحد ما يخلصوا.
 */
const waiting = new Map<Element, () => void>()
let sweepTimer = 0
let listening = false

function sweep() {
  for (const [node, show] of waiting) {
    if (node.getBoundingClientRect().top < window.innerHeight) {
      waiting.delete(node)
      show()
    }
  }
  if (waiting.size === 0) stopListening()
}

function schedule() {
  if (sweepTimer) return
  sweepTimer = window.setTimeout(() => {
    sweepTimer = 0
    sweep()
  }, 250)
}

function startListening() {
  if (listening) return
  listening = true
  window.addEventListener('scroll', schedule, { passive: true })
  window.addEventListener('resize', schedule, { passive: true })
  /* التبويب اللي اتفتح في الخلفية ما رسمش حاجة — بنمسح أول ما يبان */
  document.addEventListener('visibilitychange', schedule)
}

function stopListening() {
  if (!listening) return
  listening = false
  window.removeEventListener('scroll', schedule)
  window.removeEventListener('resize', schedule)
  document.removeEventListener('visibilitychange', schedule)
  if (sweepTimer) {
    clearTimeout(sweepTimer)
    sweepTimer = 0
  }
}

function watch(node: Element, show: () => void) {
  waiting.set(node, show)
  startListening()
  return () => {
    waiting.delete(node)
    if (waiting.size === 0) stopListening()
  }
}

/* ────────────────────────── المكوّن ────────────────────────── */

export type AppearProps = {
  children: ReactNode
  effect: ScrollAnimation
  speed?: 'slow' | 'normal' | 'fast'
  /** ترتيب العنصر جوّه البلوك — بيولّد التأخير المتدرّج */
  index?: number
  stagger?: boolean
  className?: string
  /** يمنع الحركة لعنصر بعينه حتى لو المتجر مفعّلها */
  disabled?: boolean
}

export function Appear({
  children,
  effect,
  speed = 'normal',
  index = 0,
  stagger = false,
  className = '',
  disabled,
}: AppearProps) {
  const off = disabled || effect === 'none'
  const ref = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState(off)

  /*
    مصفوفة الاعتماد ثابتة الطول عن قصد.

    لو حطّينا `shown` معاها، أول رسم بيبقى بعنصر والتاني باتنين —
    وReact بيرمي تحذيرًا وبيبطّل يضمن ترتيب التأثيرات. الكشف مرة
    واحدة بيتحكم فيه `done` جوّه، فمفيش داعي التأثير يعيد أصلًا.
  */
  useIso(() => {
    if (off) return
    const node = ref.current
    if (!node) return

    /*
      علامة إن React اشتغل فعلًا. الـCSS بيخفي العناصر لما الكلاس ده
      موجود بس — فلو React وقع، المحتوى يفضل ظاهرًا بدل ما يختفي.
    */
    document.documentElement.classList.add('sf-fx-on')

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }

    /*
      اللي ظاهر على الشاشة خلاص بيتعرض فورًا. القرار بيتاخد قبل الرسم
      عشان مفيش ولا إطار واحد بيتعرض فيه العنصر مخفي.
    */
    if (node.getBoundingClientRect().top < window.innerHeight) {
      setShown(true)
      return
    }

    /*
      الكشف بينضّف ورا نفسه: المراقب بيتفصل والعنصر بيخرج من قايمة
      المسح، فمفيش حاجة فاضلة بتقيس عنصر خلاص ظهر.
    */
    let done = false
    let unwatch = () => {}

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal()
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.04 },
    )

    function reveal() {
      if (done) return
      done = true
      observer.disconnect()
      unwatch()
      setShown(true)
    }

    observer.observe(node)
    unwatch = watch(node, reveal)

    return () => {
      observer.disconnect()
      unwatch()
    }
  }, [off])

  if (off) return <div className={className}>{children}</div>

  /*
    التدرّج بيتقفل عند ٨ عناصر: بعدها التأخير بيبقى طويل لدرجة إن
    آخر منتج في الصف يستنى نص ثانية بعد أول واحد، والعميل بيحس إن
    الصفحة بتحمّل ببطء مش إنها بتتحرّك بذوق.
  */
  const delay = stagger ? Math.min(index, 8) * 60 : 0

  return (
    <div
      ref={ref}
      data-fx={effect}
      className={`sf-ap${shown ? ' sf-ap--in' : ''} ${className}`}
      style={
        {
          '--sf-fx-dur': `${DURATION[speed]}ms`,
          '--sf-fx-delay': `${delay}ms`,
        } as React.CSSProperties
      }
    >
      {children}
    </div>
  )
}
