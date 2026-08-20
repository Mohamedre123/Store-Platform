'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'

/**
 * تتبّع سلوك الزائر.
 *
 * بيقيس القُمع: زائر → شاف منتج → ضاف للسلة → بدأ الشيك أوت. من غيره
 * التاجر بيعرف كام باع بس، مش فين بيخسر — والفرق ده هو كل الفايدة.
 *
 * مفيش أي بيانات شخصية: معرّف جلسة عشوائي في sessionStorage بيموت مع
 * قفل التبويب. مش كوكي، ومش بيتربط بالعميل، ومش محتاج موافقة تتبّع.
 *
 * `sendBeacon` أول اختيار: بيكمّل حتى لو الصفحة اتقفلت في نفس اللحظة،
 * وده بالظبط اللي بيحصل مع «بدأ الشيك أوت».
 */
export function Tracker({ storeIdentifier }: { storeIdentifier: string }) {
  const pathname = usePathname()
  const last = useRef<string | null>(null)

  useEffect(() => {
    // نفس المسار مرتين (إعادة رسم) مش زيارتين
    if (last.current === pathname) return
    last.current = pathname

    const type = pathname.includes('/products/')
      ? 'product_view'
      : pathname.endsWith('/checkout')
        ? 'begin_checkout'
        : 'page_view'

    send(storeIdentifier, type, pathname)
  }, [pathname, storeIdentifier])

  return null
}

function sessionId(): string {
  const key = 'zw_sid'
  try {
    let id = sessionStorage.getItem(key)
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36)
      sessionStorage.setItem(key, id)
    }
    return id
  } catch {
    // التخزين مرفوض — كل حدث بيبقى «جلسة» لوحده. أحسن من مفيش قياس
    return 'anon'
  }
}

/** بعت حدث — بيُستخدم من التتبّع التلقائي ومن زرار الإضافة للسلة */
export function send(storeIdentifier: string, type: string, path?: string, productId?: string) {
  try {
    const payload = JSON.stringify({
      store: storeIdentifier,
      type,
      sessionId: sessionId(),
      path: path ?? window.location.pathname,
      referrer: document.referrer || undefined,
      productId,
    })

    if (navigator.sendBeacon) {
      navigator.sendBeacon('/api/track', new Blob([payload], { type: 'application/json' }))
      return
    }

    void fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    })
  } catch {
    // القياس مش وظيفة أساسية — أي فشل هنا بيتبلع
  }
}
