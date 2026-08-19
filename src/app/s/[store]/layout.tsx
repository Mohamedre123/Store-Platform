import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStore, getStorePixels, getStoreTheme, listCategories, listFooterPages } from '@/lib/storefront'
import { StorePixels } from '@/components/storefront/pixels'
import { CartProvider } from '@/components/storefront/cart'
import { StoreHeader } from '@/components/storefront/chrome'
import { PreviewBridge } from '@/components/storefront/preview-bridge'
import { StorePreloader } from '@/components/storefront/preloader'
import { StoreFooter } from '@/components/storefront/footer'
import { StoreToolbar } from '@/components/storefront/store-toolbar'
import { LuckyWheel } from '@/components/storefront/lucky-wheel'
import { getWheelConfig } from '@/lib/wheel'
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

  const [theme, cats, pixels, policyPages, wheel] = await Promise.all([
    getStoreTheme(store.id, isPreview),
    listCategories(store.id),
    getStorePixels(store.id),
    listFooterPages(store.id),
    getWheelConfig(store.id),
  ])

  /**
   * لو الطلب جه من نطاق المتجر، الوكيل بيحط الترويسة دي وتبقى الروابط
   * الجذرية صحيحة. غير كده إحنا متقدّمين بالمسار، ولازم كل رابط داخلي
   * ياخد البادئة — وإلا العميل يضغط «المنتجات» فيخرج من متجره أصلًا.
   */
  const fromStoreHost = h.get('x-zawya-store')
  const base = fromStoreHost ? '' : '/s/' + identifier

  // المصدر الوحيد لشكل المتجر — مدموج مرة واحدة في getStoreTheme
  const custom = theme.custom

  /**
   * شعار المتجر: في المعاينة بنعرض شعار المسوّدة (اللي التاجر لسه رافعه)
   * عشان يشوفه قبل النشر؛ في النسخة الحيّة بنعرض الشعار المنشور من جدول
   * المتجر. الاتنين شعار *التاجر* — مفيش أي شعار للمنصة في متجر العميل.
   */
  const storeLogo = custom.identity.logoLight ?? store.logoLight

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
          <StorePixels pixels={pixels} preview={isPreview} />

          {custom.preloader.enabled && (
            <StorePreloader
              settings={custom.preloader}
              logo={storeLogo}
              storeName={store.name}
              preview={isPreview}
            />
          )}

          <div
            data-sf="announcement"
            style={{
              display: custom.announcement.enabled ? undefined : 'none',
              background: custom.announcement.background,
              color: custom.announcement.color,
            }}
            className={`px-4 py-2 text-center text-sm ${custom.announcement.sticky ? 'sticky top-0 z-50' : ''}`}
          >
            {custom.announcement.link ? (
              <a href={custom.announcement.link} className="hover:underline" data-sf="announcement-text">
                {custom.announcement.text}
              </a>
            ) : (
              <span data-sf="announcement-text">{custom.announcement.text}</span>
            )}
          </div>

          <StoreHeader
            storeName={store.name}
            logo={storeLogo}
            hideName={isPreview ? custom.identity.hideNameInHeader : store.hideNameInHeader}
            nav={nav}
            navStyle={custom.header.layout}
            showSearch={custom.header.showSearch}
            showCart={custom.header.showCart}
            showAccount={custom.header.showAccount}
            showCategoriesBar={custom.header.showCategoriesBar}
            sticky={custom.header.sticky}
            categories={cats.map((c) => ({ name: c.name, slug: c.slug }))}
            cartEmptyMessage={custom.cart.emptyMessage}
            currency={store.currency}
            storeSlug={store.slug}
          />

          {!store.isPublished && (
            <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-900">
              المتجر لسه مش منشور — العملاء مش شايفينه. انشره من لوحة التحكم.
            </div>
          )}

          <main className="flex-1">{children}</main>

          <StoreFooter footer={custom.footer} storeName={store.name} policyPages={policyPages} />

          <StoreToolbar toolbar={custom.toolbar} />

          {/* عجلة الحظ — مقفولة في المعاينة عشان ما تزنقش التاجر وهو بيظبّط */}
          {wheel && !isPreview && (
            <LuckyWheel
              storeIdentifier={identifier}
              title={wheel.settings.title}
              subtitle={wheel.settings.subtitle}
              delaySeconds={wheel.settings.triggerAfterSeconds}
              prizes={wheel.prizes.map((p) => ({ id: p.id, label: p.label, color: p.color }))}
            />
          )}
        </div>
      </div>
      </CartProvider>
    </StoreLinkProvider>
  )
}
