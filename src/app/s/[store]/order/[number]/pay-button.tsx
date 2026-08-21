'use client'

import { useState, useTransition } from 'react'
import { CreditCard, Loader2, TriangleAlert } from 'lucide-react'
import { retryPaymentAction } from '../../checkout/actions'

/**
 * «ادفع دلوقتي» على صفحة الطلب.
 *
 * بيظهر للطلب اللي اختار بوابة أونلاين ولسه ما اتدفعش. ده بيغطّي
 * تلات حالات بتحصل كل يوم: العميل قفل صفحة البوابة، أو بطاقته
 * اترفضت، أو البوابة كانت واقعة لحظة الطلب.
 *
 * **من غير الزرار ده، الطلب ده بيضيع.** العميل بيكلّم التاجر على
 * واتساب أو ما بيكلّمش خالص، والتاجر بيلاقي طلبًا واقفًا ما يعرفش
 * إيه اللي حصل فيه فيلغيه.
 */
export function PayNowButton({
  storeIdentifier,
  orderNumber,
  token,
  gatewayName,
  hadError,
}: {
  storeIdentifier: string
  orderNumber: number
  token: string
  gatewayName: string
  /** جه من الشيك أوت بعد ما البوابة رفضت تفتح جلسة */
  hadError?: boolean
}) {
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const pay = () =>
    start(async () => {
      setError(null)
      const res = await retryPaymentAction({ storeIdentifier, orderNumber, token })
      if (res.ok) window.location.assign(res.redirectUrl)
      else setError(res.error)
    })

  return (
    <div className="mt-6 flex flex-col gap-3 rounded-[var(--sf-radius)] border border-[var(--sf-primary)]/35 bg-[var(--sf-primary)]/5 p-4">
      <div>
        <p className="font-semibold">الطلب لسه مستنّي الدفع</p>
        <p className="mt-1 text-sm leading-relaxed opacity-70">
          {hadError
            ? `ما قدرناش نفتح صفحة ${gatewayName} دلوقتي. طلبك محفوظ — جرّب تدفع تاني، وأي وقت تحب.`
            : `اضغط عشان تكمّل الدفع عن طريق ${gatewayName}. طلبك محفوظ لحد ما تخلّص.`}
        </p>
      </div>

      {error && (
        <p
          className="flex items-start gap-2 rounded-[var(--sf-radius)] bg-red-50 px-3 py-2 text-sm text-red-700"
          role="alert"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}

      <button
        type="button"
        onClick={pay}
        disabled={pending}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-6 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <CreditCard className="h-5 w-5" aria-hidden="true" />
        )}
        {pending ? 'بنجهّز صفحة الدفع…' : 'ادفع دلوقتي'}
      </button>
    </div>
  )
}
