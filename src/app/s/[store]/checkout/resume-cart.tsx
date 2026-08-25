'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useCart } from '@/components/storefront/cart'
import { resumeCartAction } from './actions'

/**
 * يرجّع السلة من رابط الاسترداد.
 *
 * العميل بيدوس على «كمّل طلبك» من رسالة التاجر أو من التذكيرة —
 * وغالبًا من موبايله، مش من الجهاز اللي طلب منه. سلّته متخزّنة في
 * متصفّح الجهاز التاني، فالصفحة كانت بتقول له «سلتك فاضية» بعد ما
 * التاجر تعب في إنه يرجّعه.
 *
 * ## ليه بيستبدل مش بيضيف
 * السلة الحالية بتتمسح والبنود المسترجعة بتتحط مكانها. الدمج كان
 * هيخلّي اللي بيتصفّح على نفس الجهاز يلاقي كميات متضاعفة من غير ما
 * يفهم ليه.
 *
 * ## ليه مرة واحدة
 * `done` بيمنع التكرار: من غيره أي إعادة رسم بترجّع السلة تاني
 * وتلغي أي تعديل العميل عمله بعد ما رجع.
 */
export function ResumeCart({
  storeIdentifier,
  token,
  children,
}: {
  storeIdentifier: string
  token: string
  /**
   * الشيك أوت — متأخّر لحد ما الاسترجاع يخلص.
   *
   * من غير التأخير ده، «سلتك فاضية» بتظهر لثانية قبل ما البنود
   * توصل — والعميل اللي جاي من رسالة استرداد بيقفل الصفحة قبل ما
   * يشوف سلّته رجعت.
   */
  children: React.ReactNode
}) {
  const { add, clear, ready } = useCart()
  const done = useRef(false)
  /*
    الزيارة العادية مفيهاش رمز — فمفيش انتظار ولا نداء للخادم أصلًا.
    البدء بـ`true` دايمًا كان بيومض «بنرجّع سلّتك…» في وش كل عميل
    بيدخل الشيك أوت عادي.
  */
  const [busy, setBusy] = useState(Boolean(token))

  /*
    مفيش علم `alive` هنا عن قصد.

    السلة بتعيد بناء سياقها مع كل تغيير بند، فالتأثير ده بيتنضّف
    ويتعاد. لو `setBusy(false)` كانت متعلّقة بعلم بيتلغي في التنظيف،
    النداء الأول بيخلص واللاغي بيبقى مقفولًا، والتاني بيرجع من عند
    الحارس — والشاشة بتفضل على «بنرجّع سلّتك…» للأبد. الحارس المرجعي
    لوحده كافي: الشغل بيتم مرة واحدة مهما اتعاد التأثير.
  */
  useEffect(() => {
    if (!token || !ready || done.current) return
    done.current = true

    resumeCartAction({ storeIdentifier, token })
      .then((items) => {
        if (!items || items.length === 0) return

        clear()
        for (const item of items) {
          const { quantity, ...rest } = item
          /* بصمت: الدرج ما يصحّش يقع فوق الشيك أوت اللي العميل جه عشانه */
          add(rest, quantity, true)
        }

        /*
          الرمز بيتحفظ كمسوّدة عشان الطلب لو اكتمل يتكمّل على نفس
          السجل بدل ما يتعمل طلب جديد — والتاجر ما يشوفش سلة متروكة
          وطلبًا لنفس الشخص جنب بعض.
        */
        try {
          localStorage.setItem(`zw_draft_${storeIdentifier}`, token)
        } catch {}
      })
      .finally(() => setBusy(false))
  }, [ready, storeIdentifier, token, add, clear])

  if (!busy) return <>{children}</>

  return (
    <div
      className="flex items-center justify-center gap-2 py-20 text-sm opacity-70"
      role="status"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      بنرجّع سلّتك…
    </div>
  )
}
