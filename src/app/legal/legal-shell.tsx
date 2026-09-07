import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Logo } from '@/components/logo'
import { brand } from '@/lib/brand'

/**
 * قالب الصفحات القانونية.
 *
 * ## ليه قالب مشترك
 * التلات صفحات (الخصوصية، الشروط، حذف البيانات) بتتقرا من مراجعي
 * ميتا وتيك توك في نفس الجلسة. اختلاف شكلها بيخلّيهم يشكّوا إنها
 * صفحات ملزوقة من مكان تاني — وده سبب رفض حقيقي.
 *
 * ## والتاريخ ظاهر
 * السياسة من غير تاريخ سريان مالهاش قيمة قانونية، والمراجع بيدوّر
 * عليه أول حاجة.
 */
export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[var(--bg)]">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-4">
          <Link href="/" className="flex items-center gap-2">
            <Logo className="h-8 w-auto" />
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-[var(--fg-muted)] transition-colors hover:text-[var(--fg)]"
          >
            الرئيسية
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-5 py-10">
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <p className="mt-1.5 text-sm text-[var(--fg-muted)]">آخر تحديث: {updated}</p>

        {/*
          `leading-loose` لا `leading-relaxed`.

          النص القانوني بيتقرا بتركيز أعلى من نص الواجهة، والسطور
          المتلاصقة بتخلّي العين تتوه بين السطر واللي تحته.
        */}
        <div className="legal mt-8 flex flex-col gap-7 text-[15px] leading-loose">{children}</div>

        <footer className="mt-12 border-t border-[var(--border)] pt-6 text-sm text-[var(--fg-muted)]">
          <p>
            لأي استفسار:{' '}
            <a
              href={`mailto:${brand.supportEmail}`}
              dir="ltr"
              className="text-[var(--primary)] underline"
            >
              {brand.supportEmail}
            </a>
          </p>
          <nav className="mt-3 flex flex-wrap gap-4">
            <Link href="/privacy" className="hover:text-[var(--fg)]">
              سياسة الخصوصية
            </Link>
            <Link href="/terms" className="hover:text-[var(--fg)]">
              شروط الاستخدام
            </Link>
            <Link href="/data-deletion" className="hover:text-[var(--fg)]">
              حذف بياناتك
            </Link>
          </nav>
        </footer>
      </main>
    </div>
  )
}

/** عنوان قسم — رقمه بيخلّي الإحالة عليه في المراسلات ممكنة */
export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="text-lg font-bold">
        <span className="tabular me-1.5 text-[var(--fg-subtle)]">{n}.</span>
        {title}
      </h2>
      {children}
    </section>
  )
}

/** قايمة نقط — بمسافة مريحة للقراية الطويلة */
export function List({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="flex list-disc flex-col gap-1.5 ps-5 text-[var(--fg-muted)]">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}
