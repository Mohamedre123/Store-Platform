'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { RefreshCw, ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/logo'
import { AuroraBackground } from '@/components/motion'

/**
 * حدّ الخطأ للموقع التعريفي ولوحة التحكم.
 *
 * ## ليه ده موجود
 * من غيره، أي خطأ لحظي في الخادم — نشر جديد وهو بيتبدّل، أو اتصال
 * بقاعدة البيانات وقع للحظة — بيوصل للمستخدم كصفحة إنجليزي سودة
 * مكتوب فيها «A server error occurred» ورقم مبهم. المستخدم ما بيعرفش
 * حصل إيه، ولا إن إعادة التحميل غالبًا بتحلّها، ولا إن حاجته اتحفظت
 * ولا لأ.
 *
 * الصفحة دي بتقول الكلام بالعربي وبتدّي زرار يعيد المحاولة في مكانه
 * من غير ما يفقد صفحته.
 *
 * ## `reset` مش «إعادة تحميل»
 * بتعيد رسم الجزء اللي وقع بس. ده أرخص وأسرع من إعادة تحميل الصفحة
 * كلها، وبينجح مع الأخطاء اللحظية — وأغلبها لحظي.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  /*
    رابط اللوحة للتاجر بس.

    الحدّ ده بيمسك أخطاء واجهة المتجر كمان لما تخطيطها هو اللي يقع
    (الحدّ الأقرب ما بيمسكش خطأ تخطيطه). ساعتها اللي قدام الشاشة
    **عميل التاجر** لا التاجر — ورابط «لوحة التحكم» في وشّه بيوديه
    لتسجيل دخول مالوش علاقة بيه.

    بيتحسب بعد التركيب لأن `location` مش موجود على الخادم؛ والقيمة
    الأولى `false` عشان الرابط ما يومضش قبل ما نعرف.
  */
  const [inDashboard, setInDashboard] = useState(false)

  useEffect(() => {
    setInDashboard(window.location.pathname.startsWith('/dashboard'))
  }, [])

  useEffect(() => {
    // الرقم ده هو نفسه اللي بيظهر في سجلات Vercel — بيه بنلاقي الخطأ
    console.error('خطأ في الصفحة:', error.digest ?? '', error)
  }, [error])

  return (
    <>
      <AuroraBackground />
      <main className="min-h-screen-safe relative flex flex-col items-center justify-center gap-7 px-6 text-center">
        <Logo size="lg" priority />

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight">حصلت مشكلة مؤقتة</h1>
          <p className="max-w-sm text-[var(--fg-muted)]">
            الصفحة ما قدرتش تحمّل دلوقتي. جرّب تاني — ده بيحصل ساعات وقت التحديثات وبيعدّي في
            ثواني.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="zw-lift zw-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-fg)] shadow-[var(--shadow-soft)]"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            جرّب تاني
          </button>

          <Link
            href={inDashboard ? '/dashboard' : '/'}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--border-strong)] px-6 text-sm font-semibold text-[var(--fg)] transition-colors hover:bg-[var(--surface-2)]"
          >
            {inDashboard ? 'لوحة التحكم' : 'الرجوع للرئيسية'}
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {error.digest && (
          <p className="text-xs text-[var(--fg-subtle)]">
            رقم الخطأ:{' '}
            <bdi dir="ltr" className="tabular font-mono">
              {error.digest}
            </bdi>
          </p>
        )}
      </main>
    </>
  )
}
