import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/logo'
import { AuroraBackground } from '@/components/motion'

export const metadata = { title: 'الصفحة مش موجودة' }

export default function NotFound() {
  return (
    <>
      <AuroraBackground />
      <main className="min-h-screen-safe relative flex flex-col items-center justify-center gap-7 px-6 text-center">
        <Logo size="lg" priority />
        <div className="flex flex-col gap-2">
          <p className="tabular text-6xl font-bold tracking-tight text-[var(--primary)]">٤٠٤</p>
          <h1 className="text-2xl font-bold tracking-tight">الصفحة دي مش موجودة</h1>
          <p className="max-w-sm text-[var(--fg-muted)]">
            يمكن الرابط اتغيّر أو اتكتب غلط. ارجع للرئيسية ونكمّل من هناك.
          </p>
        </div>
        <Link
          href="/"
          className="zw-lift zw-press inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-fg)] shadow-[var(--shadow-soft)]"
        >
          الرجوع للرئيسية
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
      </main>
    </>
  )
}
