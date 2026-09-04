'use client'

import { useState, useTransition } from 'react'
import { saveAutoShipAction } from './actions'
import { Toggle } from '@/components/dashboard/controls'
import { Card } from '@/components/ui'
import { toast } from '@/components/dashboard/toast'

/**
 * تسجيل الشحنة تلقائيًا عند التأكيد.
 *
 * ## ليه المفتاح ده موجود أصلًا
 * السلوك كان دايمًا مفتوح بلا أي طريق يقفله. والتاجر اللي بيطبع
 * بوليصاته دفعة واحدة آخر اليوم، أو بيراجع المخزون قبل ما يشحن،
 * كان بيلاقي بوليصة اتعملت لحظة ما دوس «تأكيد» — وإلغاؤها بيكلّف
 * عند بعض الشركات.
 *
 * ## وبيظهر لما فيه شركة مربوطة بس
 * مفتاح بيتكلّم عن شركة شحن مش موجودة بيسأل التاجر سؤالًا مالوش
 * معنى عنده.
 */
export function AutoShipCard({
  initial,
  carrierName,
}: {
  initial: boolean
  /** اسم الشركة المربوطة — الكارت مش بيظهر من غيرها */
  carrierName: string | null
}) {
  const [on, setOn] = useState(initial)
  const [, start] = useTransition()

  if (!carrierName) return null

  return (
    <Card className="p-5">
      <Toggle
        label="سجّل الشحنة تلقائيًا لما الطلب يتأكّد"
        hint={
          on
            ? `أول ما تأكّد طلبًا، بنسجّله عند ${carrierName} وناخد رقم البوليصة. لو الشركة رفضت، الطلب بيفضل زي ما هو والسبب بيظهر على كارت الشركة.`
            : `الطلبات هتفضل مستنيّة، وإنت اللي بتبعتها لـ${carrierName} من صفحة الشحنات. مفيد لو بتطبع بوليصاتك دفعة واحدة.`
        }
        checked={on}
        onChange={(v) => {
          /*
            الشاشة بتتحرّك قبل الخادم.

            المفتاح ده بيتقفل ويتفتح وهو بيجرّب، والانتظار على كل
            ضغطة بيخلّيه يحس إن الشاشة واقفة. ولو الحفظ فشل بيرجع
            لمكانه ومعاه السبب.
          */
          setOn(v)
          start(async () => {
            const res = await saveAutoShipAction(v)
            if (res?.error) {
              setOn(!v)
              toast(res.error, 'error')
            } else {
              toast(v ? 'التسجيل التلقائي شغّال' : 'اتقفل — هتسجّل بإيدك')
            }
          })
        }}
      />
    </Card>
  )
}
