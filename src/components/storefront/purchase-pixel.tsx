'use client'

import { useEffect, useRef } from 'react'

/**
 * حدث الشرا في متصفح العميل — بنفس المعرّف اللي الخادم بعت بيه.
 *
 * ## ليه الاتنين مع بعض
 * حدث الخادم بيعدّي دايمًا (مانع الإعلانات وiOS ما بيوقّفوهوش)،
 * لكن حدث المتصفح بيجيب كوكيز ميتا (`_fbp` و`_fbc`) اللي بترفع دقة
 * المطابقة جدًا. الاتنين بيدّوا صورة أكمل من أي واحد لوحده.
 *
 * ## و`eventID` هو اللي بيمنع الازدواج
 * ميتا وتيك توك بيقارنوا المعرّف: لو الاتنين وصلوا، الحدث بيتحسب
 * **مرة واحدة**. من غيره الطلب بيتحسب بيعتين والتاجر بيبني قرار
 * ميزانيته على ضِعف الحقيقة.
 *
 * ## وبيتبعت مرة واحدة لكل طلب
 * صفحة الشكر بتتفتح أكتر من مرة: العميل بيعمل تحديث، وبيرجع لها من
 * رسالة التتبّع، وبيفتحها على موبايله بعد الكمبيوتر. من غير الختم
 * في `sessionStorage`، كل فتحة كانت بتبعت حدث شرا جديد.
 *
 * والختم في `sessionStorage` لا `localStorage` عن قصد: العميل اللي
 * بيرجع بعد شهر لنفس الطلب مالوش دعوة بختم قديم، والمعرّف نفسه
 * بيمنع الازدواج عند ميتا في الحالة دي.
 */
export function PurchasePixel({
  eventId,
  value,
  currency,
  contentIds,
}: {
  eventId: string
  /** بالقرش زي كل مبالغ المنصة — التحويل للوحدة الكبرى هنا */
  value: number
  currency: string
  contentIds: string[]
}) {
  const fired = useRef(false)

  useEffect(() => {
    if (fired.current) return
    fired.current = true

    const stampKey = `zw_purchase_${eventId}`
    try {
      if (sessionStorage.getItem(stampKey)) return
      sessionStorage.setItem(stampKey, '1')
    } catch {
      /*
        المتصفح رافض التخزين (تصفّح خاص، أو إعدادات صارمة).

        بنكمّل ونبعت: حدث مكرر أحسن من حدث ما اتبعتش — والمعرّف
        الموحّد بيخلّي ميتا تشيل التكرار عندها برضه.
      */
    }

    const amount = Number((value / 100).toFixed(2))

    const w = window as unknown as {
      fbq?: (...args: unknown[]) => void
      ttq?: { track: (name: string, props?: unknown, opts?: unknown) => void }
      snaptr?: (...args: unknown[]) => void
      gtag?: (...args: unknown[]) => void
    }

    w.fbq?.(
      'track',
      'Purchase',
      {
        value: amount,
        currency,
        content_ids: contentIds,
        content_type: 'product',
      },
      { eventID: eventId },
    )

    w.ttq?.track(
      'CompletePayment',
      { value: amount, currency, contents: contentIds.map((id) => ({ content_id: id })) },
      { event_id: eventId },
    )

    w.snaptr?.('track', 'PURCHASE', { price: amount, currency, transaction_id: eventId })

    w.gtag?.('event', 'purchase', {
      transaction_id: eventId,
      value: amount,
      currency,
    })
  }, [eventId, value, currency, contentIds])

  return null
}
