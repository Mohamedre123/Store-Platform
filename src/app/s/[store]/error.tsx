'use client'

import { useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

/**
 * حدّ الخطأ لواجهة المتجر.
 *
 * ## منفصل عن حدّ المنصة عن قصد
 * ده اللي **عميل التاجر** بيشوفه، مش التاجر. فمفيش فيه شعار زاوية
 * ولا رابط للوحة التحكم — العميل مالوش دعوة بالمنصة اللي المتجر
 * مبني عليها، ورابط لوحة تحكم في وش زبون بيبان غلطًا.
 *
 * ## ليه ألوان محايدة
 * الخطأ ممكن يقع **قبل** ما ثيم المتجر يتحمّل، فمتغيّرات
 * `--sf-*` ممكن ما تكونش موجودة أصلًا. الألوان هنا من نظام المنصة
 * اللي بيتحمّل مع الجذر — صفحة رمادية مقروءة أحسن من صفحة بتقرا
 * متغيّرات فاضية فتطلع نص أبيض على أبيض.
 */
export default function StorefrontError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('خطأ في واجهة المتجر:', error.digest ?? '', error)
  }, [error])

  return (
    <main className="min-h-screen-safe flex flex-col items-center justify-center gap-6 px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--fg-muted)]">
        <RefreshCw className="h-6 w-6" aria-hidden="true" />
      </span>

      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-bold tracking-tight">الصفحة ما فتحتش</h1>
        <p className="max-w-sm text-sm leading-relaxed text-[var(--fg-muted)]">
          حصلت مشكلة مؤقتة عندنا. جرّب تاني — سلتك زي ما هي وما ضاعش منها حاجة.
        </p>
      </div>

      <button
        type="button"
        onClick={reset}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90"
      >
        <RefreshCw className="h-4 w-4" aria-hidden="true" />
        جرّب تاني
      </button>

      {error.digest && (
        <p className="text-xs text-[var(--fg-subtle)]">
          رقم الخطأ:{' '}
          <bdi dir="ltr" className="tabular font-mono">
            {error.digest}
          </bdi>
        </p>
      )}
    </main>
  )
}
