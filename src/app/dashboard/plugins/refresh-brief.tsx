'use client'

import { useState, useTransition } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { refreshAiBriefAction } from './ai-actions'

/**
 * زرار «حدّث معلومات المساعد».
 *
 * ## المشكلة اللي بيحلّها
 * نبذة المتجر بتتولّد **مرة واحدة** لما التاجر يتحقّق من مفتاحه،
 * وبتفضل زي ما هي بعد كده. فالتاجر يشيل الشحن المجاني، ويضيف أقسام،
 * ويغيّر أسعاره — والمساعد لسه بيقول كلام الشهر اللي فات للعميل.
 *
 * ده مش تفصيلة شكلية: العميل بيسمع الكلام على إنه من المتجر وبيبني
 * عليه قرار شرا. معلومة قديمة بتتقال باسم التاجر أسوأ من مساعد مش
 * موجود.
 *
 * ## وليه زرار لا تحديث تلقائي
 * النبذة نص التاجر بيقدر يزوّد عليه («بنشحن للإسكندرية في يوم»).
 * التحديث التلقائي كان هيمسح كلامه كل ما يضيف منتج — فالقرار قراره.
 */
export function RefreshBriefButton({
  onDone,
}: {
  /** بيحطّ النص الجديد في الخانة على طول — التاجر يشوفه قبل ما يحفظ */
  onDone: (brief: string) => void
}) {
  const [pending, start] = useTransition()
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          setMsg(null)
          start(async () => {
            const res = await refreshAiBriefAction()
            if (res.ok) {
              onDone(res.brief)
              setMsg({ ok: true, text: 'اتحدّثت من بيانات متجرك دلوقتي' })
            } else {
              setMsg({ ok: false, text: res.error })
            }
          })
        }}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-2.5 text-xs font-medium transition-colors hover:bg-[var(--surface-2)] disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        حدّث معلومات المساعد
      </button>

      {msg && (
        <span
          className={`text-xs font-medium ${
            msg.ok ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
          }`}
        >
          {msg.text}
        </span>
      )}
    </span>
  )
}
