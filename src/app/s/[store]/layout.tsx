import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStore, getStoreTheme, listCategories } from '@/lib/storefront'
import { CartProvider } from '@/components/storefront/cart'
import { StoreHeader } from '@/components/storefront/chrome'
import { PreviewBridge } from '@/components/storefront/preview-bridge'
import { StorePreloader } from '@/components/storefront/preloader'
import { StoreToolbar } from '@/components/storefront/store-toolbar'
import { StoreLinkProvider } from '@/components/storefront/store-link'
import { FONT_STACKS, RADIUS_PX } from '@/lib/customization'

export const dynamic = 'force-dynamic'

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

  const h = await headers()
  const isPreview = h.get('x-zawya-preview') === '1'

  const theme = await getStoreTheme(store.id, isPreview)
  const cats = await listCategories(store.id)

  /**
   * لو الطلب جه من نطاق المتجر، الوكيل بيحط الترويسة دي وتبقى الروابط
   * الجذرية صحيحة. غير كده إحنا متقدّمين بالمسار، ولازم كل رابط داخلي
   * ياخد البادئة — وإلا العميل يضغط «المنتجات» فيخرج من متجره أصلًا.
   */
  const fromStoreHost = h.get('x-zawya-store')
  const base = fromStoreHost ? '' : '/s/' + identifier

  // المصدر الوحيد لشكل المتجر — مدموج مرة واحدة في getStoreTheme
  const custom = theme.custom

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
    '--sf-primary': custom.identity.primary,
    '--sf-accent': custom.identity.accent,
    '--sf-bg': custom.identity.background,
    '--sf-surface': custom.identity.surface,
    '--sf-text': custom.identity.text,
    '--sf-radius': RADIUS_PX[custom.identity.radius],
    '--sf-font-heading': FONT_STACKS[custom.identity.fontHeading],
    '--sf-font-body': FONT_STACKS[custom.identity.fontBody],
    fontFamily: 'var(--sf-font-body)',
  } as React.CSSProperties

  return (
    <StoreLinkProvider base={base}>
      <CartProvider storeSlug={store.slug}>
      <div
        style={vars}
        data-zawya-store
        className="min-h-screen-safe flex flex-col"
        // لون النص والخلفية من المتجر لا من المنصة
      >
        <div style={{ background: 'var(--sf-bg)', color: 'var(--sf-text)' }} className="flex min-h-full flex-1 flex-col">
          <PreviewBridge />

          {custom.preloader.enabled && (
            <StorePreloader settings={custom.preloader} logo={store.logoLight} storeName={store.name} />
          )}

          <div
            data-sf="announcement"
            style={{
              display: custom.announcement.enabled ? undefined : 'none',
              background: custom.announcement.background,
              color: custom.announcement.color,
            }}
            className="px-4 py-2 text-center text-sm"
          >
            <span data-sf="announcement-text">{custom.announcement.text}</span>
          </div>

          <StoreHeader
            storeName={store.name}
            logo={store.logoLight}
            hideName={store.hideNameInHeader}
            nav={nav}
            navStyle={custom.header.layout}
            showSearch={custom.header.showSearch}
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
              <span>{custom.footer.copyright || `© ${new Date().getFullYear()} ${store.name}`}</span>
              <span data-sf="powered-by" style={{ display: custom.footer.showPoweredBy ? undefined : 'none' }} className="opacity-70">
                مدعوم بـزاوية
              </span>
            </div>
          </footer>

          <StoreToolbar toolbar={custom.toolbar} />
        </div>
      </div>
      </CartProvider>
    </StoreLinkProvider>
  )
}
