import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStore, getStoreTheme, listCategories } from '@/lib/storefront'
import { CartProvider } from '@/components/storefront/cart'
import { StoreHeader } from '@/components/storefront/chrome'

export const dynamic = 'force-dynamic'

const RADIUS = { none: '0px', sm: '4px', md: '8px', lg: '14px', full: '999px' } as const

export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string }>
}): Promise<Metadata> {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) return { title: 'المتجر مش موجود' }

  return {
    // absolute يمنع قالب المنصة («… | زاوية») من إضافة اسمها لعنوان
    // متجر التاجر — المتجر علامة مستقلة مش صفحة تابعة لنا
    title: { absolute: store.name, template: `%s | ${store.name}` },
    description: store.tagline ?? `تسوّق من ${store.name}`,
    icons: store.logoLight ? { icon: store.logoLight } : undefined,
    openGraph: { title: store.name, description: store.tagline ?? undefined, type: 'website' },
  }
}

export default async function StorefrontLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ store: string }>
}) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const theme = await getStoreTheme(store.id)
  const cats = await listCategories(store.id)

  const nav = [
    { label: 'الرئيسية', href: '/' },
    { label: 'كل المنتجات', href: '/products' },
    ...cats.slice(0, 4).map((c) => ({ label: c.name, href: `/category/${c.slug}` })),
  ]

  /**
   * ألوان المتجر تُحقن كمتغيّرات CSS على الحاوية.
   * كده الثيم بيتغيّر بتبديل قيم، من غير أي كلاسات مشروطة في المكوّنات.
   */
  const vars = {
    '--sf-primary': theme.tokens.primary,
    '--sf-accent': theme.tokens.accent ?? theme.tokens.primary,
    '--sf-bg': theme.tokens.background ?? '#ffffff',
    '--sf-surface': theme.tokens.surface ?? '#ffffff',
    '--sf-text': theme.tokens.text ?? '#111111',
    '--sf-radius': RADIUS[theme.tokens.radius ?? 'md'],
  } as React.CSSProperties

  return (
    <CartProvider storeSlug={store.slug}>
      <div
        style={vars}
        className="min-h-screen-safe flex flex-col"
        // لون النص والخلفية من المتجر لا من المنصة
      >
        <div style={{ background: 'var(--sf-bg)', color: 'var(--sf-text)' }} className="flex min-h-full flex-1 flex-col">
          <StoreHeader
            storeName={store.name}
            logo={store.logoLight}
            hideName={store.hideNameInHeader}
            nav={nav}
            navStyle={theme.definition.layout.nav}
            showSearch={theme.definition.layout.showSearchInHeader}
            currency={store.currency}
            storeSlug={store.slug}
          />

          {!store.isPublished && (
            <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
              المتجر لسه مش منشور — العملاء مش شايفينه. انشره من لوحة التحكم.
            </div>
          )}

          <main className="flex-1">{children}</main>

          <footer className="border-t border-[var(--sf-text)]/10 py-8">
            <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 text-sm opacity-65 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <span>© {new Date().getFullYear()} {store.name}</span>
              <span className="opacity-70">مدعوم بـزاوية</span>
            </div>
          </footer>
        </div>
      </div>
    </CartProvider>
  )
}
