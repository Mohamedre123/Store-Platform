import { Logo } from '@/components/logo'
import { AuroraBackground } from '@/components/motion'
import Link from 'next/link'
import { brand } from '@/lib/brand'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen-safe flex flex-col">
      <AuroraBackground />
      <header className="border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-5xl items-center px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <Logo size="md" priority />
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:py-16">
        <div className="w-full max-w-md">{children}</div>
      </main>

      <footer className="px-4 py-6 text-center text-xs text-[var(--fg-subtle)]">
        {brand.name} — {brand.tagline}
      </footer>
    </div>
  )
}
