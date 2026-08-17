import { getDashboardContext } from '@/lib/store-context'
import { Sidebar } from '@/components/dashboard/sidebar'
import { AuroraBackground } from '@/components/motion'
import { storeUrl } from '@/lib/domain'
import { logoutAction } from '@/app/(auth)/actions'
import { ExternalLink, LogOut } from 'lucide-react'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, store } = await getDashboardContext()

  return (
    <div className="min-h-screen-safe">
      <AuroraBackground />
      <Sidebar storeName={store.name} storeSlug={store.slug} storeLogo={store.logoLight} />

      <div className="lg:ms-64">
        {/* الشريط العلوي */}
        <header className="sticky top-0 z-30 hidden h-16 items-center justify-between gap-4 border-b border-[var(--border)] bg-[var(--surface)]/85 px-6 backdrop-blur-md lg:flex">
          <a
            href={storeUrl(store.slug)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 py-2 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            عرض المتجر
          </a>

          <div className="flex items-center gap-3">
            <div className="text-end">
              <p className="text-sm font-medium">{user.name}</p>
              <p dir="ltr" className="text-xs text-[var(--fg-subtle)]">{user.email}</p>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="تسجيل الخروج"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--color-danger)]"
              >
                <LogOut className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </form>
          </div>
        </header>

        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
      </div>
    </div>
  )
}
