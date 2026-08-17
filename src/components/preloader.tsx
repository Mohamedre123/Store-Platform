'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { brand } from '@/lib/brand'

/**
 * شاشة التحميل الأولى.
 *
 * كل وضع بياخد نسخة الشعار اللي تبان عليه: الوضع الفاتح بالشعار
 * الملوّن الأصلي، والداكن بالشعار الأبيض. سبب ده إن كتابة الشعار
 * الأصلي كحلي غامق، فبتختفي على أي خلفية غامقة.
 *
 * تختفي بمجرد جاهزية الصفحة، وفيها احتياطي CSS يخفيها حتى لو
 * الجافاسكربت وقع — عشان ما تفضلش حاجبة الموقع أبدًا.
 */
export function Preloader() {
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const finish = () => {
      // تأخير بسيط عشان الشعار ما يومضش ويختفي فجأة
      window.setTimeout(() => setHidden(true), 350)
    }

    if (document.readyState === 'complete') {
      finish()
      return
    }

    window.addEventListener('load', finish, { once: true })
    // احتياطي: لو حدث load ما جاش لأي سبب
    const safety = window.setTimeout(finish, 2500)

    return () => {
      window.removeEventListener('load', finish)
      window.clearTimeout(safety)
    }
  }, [])

  return (
    <div
      className={`zw-preloader${hidden ? ' zw-preloader--done' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="جاري التحميل"
    >
      <div className="zw-preloader__glow" aria-hidden="true" />
      <div className="zw-preloader__mark">
        <Image
          src={brand.mark}
          alt={brand.name}
          width={200}
          height={200}
          priority
          sizes="(max-width: 480px) 140px, 180px"
          className="zw-preloader__logo zw-preloader__logo--light"
        />
        <Image
          src={brand.markDark}
          alt=""
          aria-hidden="true"
          width={200}
          height={200}
          priority
          sizes="(max-width: 480px) 140px, 180px"
          className="zw-preloader__logo zw-preloader__logo--dark"
        />
        <span className="zw-preloader__bar" aria-hidden="true" />
      </div>
    </div>
  )
}
