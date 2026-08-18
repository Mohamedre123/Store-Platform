'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import type { PreloaderSettings } from '@/lib/customization'

/**
 * شاشة تحميل المتجر.
 *
 * بتظهر لحظة فتح المتجر بلوجو التاجر وألوانه، وتختفي أول ما الصفحة
 * تجهز. الهدف إحساس بالاحتراف — العميل يشوف هوية المتجر بدل وميض أبيض.
 *
 * بتختفي دايمًا بعد ثانيتين كحد أقصى حتى لو حصل خطأ، عشان ما تحبسش
 * العميل بره متجره أبدًا.
 */
export function StorePreloader({
  settings,
  logo,
  storeName,
  preview = false,
}: {
  settings: PreloaderSettings
  logo: string | null
  storeName: string
  /** في المعاينة بتفضل ظاهرة عشان التاجر يشوف تعديلاته على اللون والشكل */
  preview?: boolean
}) {
  const [gone, setGone] = useState(false)
  const [hiding, setHiding] = useState(false)

  useEffect(() => {
    // في المعاينة بتفضل ظاهرة مدة أطول عشان التاجر يشوف لونها وشكلها،
    // وكل تعديل بيعيد تحميل الإطار فبتظهر تاني — من غير ما تحجب باقي
    // المتجر للأبد. في المتجر الحقيقي بتختفي بسرعة أول ما يحمّل.
    const hide = () => setHiding(true)
    if (preview) {
      const t = setTimeout(hide, 2600)
      return () => clearTimeout(t)
    }
    const min = setTimeout(hide, 500)
    const max = setTimeout(hide, 1200)
    if (document.readyState === 'complete') setTimeout(hide, 400)
    else window.addEventListener('load', hide, { once: true })

    return () => {
      clearTimeout(min)
      clearTimeout(max)
      window.removeEventListener('load', hide)
    }
  }, [preview])

  useEffect(() => {
    if (!hiding) return
    const t = setTimeout(() => setGone(true), 400)
    return () => clearTimeout(t)
  }, [hiding])

  if (gone) return null

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-400"
      style={{ background: settings.background, opacity: hiding ? 0 : 1, pointerEvents: hiding ? 'none' : 'auto' }}
    >
      {settings.style === 'logo' && logo ? (
        <div className="zawya-pulse relative h-20 w-20">
          <Image src={logo} alt={storeName} fill sizes="80px" className="object-contain" />
        </div>
      ) : settings.style === 'logo' ? (
        <span className="zawya-pulse text-2xl font-bold" style={{ color: settings.color }}>
          {storeName}
        </span>
      ) : settings.style === 'dots' ? (
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="zawya-bounce h-3 w-3 rounded-full"
              style={{ background: settings.color, animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      ) : (
        <span
          className="zawya-spin h-12 w-12 rounded-full border-[3px]"
          style={{ borderColor: settings.color, borderTopColor: 'transparent' }}
        />
      )}

      <style>{`
        @keyframes zawya-pulse { 0%,100% { transform: scale(1); opacity: .7 } 50% { transform: scale(1.08); opacity: 1 } }
        @keyframes zawya-bounce { 0%,80%,100% { transform: translateY(0); opacity: .5 } 40% { transform: translateY(-10px); opacity: 1 } }
        @keyframes zawya-spin { to { transform: rotate(360deg) } }
        .zawya-pulse { animation: zawya-pulse 1.1s ease-in-out infinite }
        .zawya-bounce { animation: zawya-bounce 1.2s ease-in-out infinite }
        .zawya-spin { animation: zawya-spin .7s linear infinite }
      `}</style>
    </div>
  )
}
