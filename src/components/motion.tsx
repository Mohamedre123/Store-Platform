'use client'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

/**
 * دخول لمحتوى أول الشاشة — حركة CSS خالصة، من غير جافاسكربت.
 *
 * المحتوى اللي المستخدم بيشوفه أول ما يفتح الصفحة ما ينفعش يستنى
 * React يشتغل عشان يظهر. على موبايل ضعيف أو نت بطيء ده معناه
 * صفحة فاضية لثواني. عشان كده الحركة دي CSS بحت.
 */
export function Enter({
  children,
  as: Tag = 'div',
  delay = 0,
  y = 22,
  className = '',
}: {
  children: ReactNode
  as?: ElementType
  delay?: number
  y?: number
  className?: string
}) {
  return (
    <Tag
      className={`zw-enter ${className}`}
      style={{ '--zw-delay': `${delay}ms`, '--zw-y': `${y}px` } as React.CSSProperties}
    >
      {children}
    </Tag>
  )
}

/**
 * ظهور تدريجي عند الوصول للعنصر أثناء التمرير.
 *
 * لو المتصفح ما يدعمش IntersectionObserver أو المستخدم مفعّل «تقليل الحركة»،
 * المحتوى يظهر فورًا — الحركة زينة، والمحتوى هو الأصل.
 */
export function Reveal({
  children,
  as: Tag = 'div',
  delay = 0,
  y = 20,
  className = '',
}: {
  children: ReactNode
  as?: ElementType
  delay?: number
  y?: number
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)
  const [shown, setShown] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    /**
     * علامة إن React اشتغل فعلًا. الـCSS بيخفي عناصر الظهور
     * لما الكلاس ده موجود بس — فلو React وقع، المحتوى يفضل
     * ظاهرًا بدل ما يختفي للأبد.
     */
    document.documentElement.classList.add('zw-hydrated')

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setShown(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true)
            observer.disconnect()
          }
        }
      },
      // نبدأ الحركة قبل ما العنصر يدخل الشاشة بشوية عشان تبقى ناعمة
      { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`zw-reveal${shown ? ' zw-reveal--in' : ''} ${className}`}
      style={{ '--zw-delay': `${delay}ms`, '--zw-y': `${y}px` } as React.CSSProperties}
    >
      {children}
    </Tag>
  )
}

/**
 * خلفية متحركة: ثلاث هالات لونية كبيرة تنساب ببطء.
 *
 * الحركة على transform فقط (تُنفَّذ على كرت الشاشة) عشان تفضل ناعمة
 * على الموبايلات المتوسطة، والعنصر كله يختفي مع «تقليل الحركة».
 */
export function AuroraBackground() {
  return (
    <div className="zw-aurora" aria-hidden="true">
      <span className="zw-aurora__blob zw-aurora__blob--1" />
      <span className="zw-aurora__blob zw-aurora__blob--2" />
      <span className="zw-aurora__blob zw-aurora__blob--3" />
      <span className="zw-aurora__grid" />
    </div>
  )
}

/** بطاقة ترتفع قليلًا وتتبع مؤشر الماوس بلمعة خفيفة */
export function SpotlightCard({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  return (
    <div
      ref={ref}
      className={`zw-spotlight ${className}`}
      onPointerMove={(e) => {
        // اللمس لا يحتاج تتبّعًا — البقعة للماوس فقط
        if (e.pointerType !== 'mouse') return
        const el = ref.current
        if (!el) return
        const rect = el.getBoundingClientRect()
        el.style.setProperty('--zw-mx', `${e.clientX - rect.left}px`)
        el.style.setProperty('--zw-my', `${e.clientY - rect.top}px`)
      }}
    >
      {children}
    </div>
  )
}

/** عدّاد يتحرّك من صفر للرقم النهائي عند ظهوره */
export function CountUp({
  to,
  suffix = '',
  duration = 1400,
}: {
  to: number
  suffix?: string
  duration?: number
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const [value, setValue] = useState(0)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || typeof IntersectionObserver === 'undefined') {
      setValue(to)
      return
    }

    let frame = 0
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        observer.disconnect()
        const start = performance.now()
        const step = (now: number) => {
          const t = Math.min((now - start) / duration, 1)
          // تباطؤ في النهاية بدل توقّف مفاجئ
          const eased = 1 - Math.pow(1 - t, 3)
          setValue(Math.round(to * eased))
          if (t < 1) frame = requestAnimationFrame(step)
        }
        frame = requestAnimationFrame(step)
      },
      { threshold: 0.4 },
    )

    observer.observe(node)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [to, duration])

  return (
    <span ref={ref} className="tabular">
      {value.toLocaleString('ar-EG')}
      {suffix}
    </span>
  )
}
