import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getStore, getStorePixels, getStoreTheme, listCartUpsell, listCategories, listFooterPages } from '@/lib/storefront'
import { StorePixels } from '@/components/storefront/pixels'
import { Tracker } from '@/components/storefront/tracker'
import { CartProvider } from '@/components/storefront/cart'
import { StoreHeader } from '@/components/storefront/chrome'
import { PreviewBridge } from '@/components/storefront/preview-bridge'
import { StorePreloader } from '@/components/storefront/preloader'
import { StoreFooter } from '@/components/storefront/footer'
import { StoreToolbar } from '@/components/storefront/store-toolbar'
import { MobileNav } from '@/components/storefront/mobile-nav'
import { AnnouncementBar } from '@/components/storefront/announcement-bar'
import { LuckyWheel } from '@/components/storefront/lucky-wheel'
import { getWheelConfig } from '@/lib/wheel'
import { getAiConfig, isReady } from '@/lib/ai/settings'
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
    /*
      undefined هنا كان معناه «ورّث» — يعني أيقونة زاوية تظهر في تبويب
      متجر التاجر. القايمة الفاضية بتلغي الوراثة: التاجر من غير شعار
      ياخد أيقونة المتصفح العادية، أحسن من علامة حد تاني.
    */
    icons: store.logoLight ? { icon: store.logoLight } : { icon: [] },
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

  /**
   * صفحات الهبوط بتتعرض عارية — من غير هيدر ولا فوتر ولا عجلة.
   *
   * دي صفحة حملة إعلانية هدفها بيعة واحدة: أي رابط تاني في الصفحة
   * فرصة إن العميل يسيبها من غير ما يشتري. وهويتها مستقلة عن المتجر
   * أصلًا، فالهيدر بلون المتجر كان هيبوّظ شكلها.
   */
  const path = h.get('x-zawya-path') ?? ''
  if (path.includes('/lp/')) {
    return <>{children}</>
  }

  const [theme, cats, pixels, policyPages, wheel] = await Promise.all([
    getStoreTheme(store.id, isPreview),
    listCategories(store.id),
    getStorePixels(store.id),
    listFooterPages(store.id),
    getWheelConfig(store.id),
  ])

  /*
    مساعد المتجر — مقفول في المعاينة زي عجلة الحظ.
    كل رسالة بتستهلك من رصيد التاجر، وتجاربه وهو بيظبّط الشكل ما
    يصحّش تتحسب عليه.
  */
  const ai = await getAiConfig(store.id)
  const botReady = !isPreview && ai.botEnabled && isReady(ai)

  /**
   * لو الطلب جه من نطاق المتجر، الوكيل بيحط الترويسة دي وتبقى الروابط
   * الجذرية صحيحة. غير كده إحنا متقدّمين بالمسار، ولازم كل رابط داخلي
   * ياخد البادئة — وإلا العميل يضغط «المنتجات» فيخرج من متجره أصلًا.
   */
  const fromStoreHost = h.get('x-zawya-store')
  const base = fromStoreHost ? '' : '/s/' + identifier

  // المصدر الوحيد لشكل المتجر — مدموج مرة واحدة في getStoreTheme
  const custom = theme.custom

  /*
    مقترحات السلة بتتحمّل في التخطيط لا في الدرج: الدرج مكوّن عميل،
    وأول ما العميل يفتحه لازم يلاقي المقترحات جاهزة — لو استنى طلبًا
    للشبكة، القسم بيظهر بعد ما يكون خلاص قرّر ويضغط «إتمام الطلب».
  */
  const cartUpsell = custom.cart.showUpsell ? await listCartUpsell(store.id) : []

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
      <CartProvider
        storeSlug={store.slug}
        storeIdentifier={identifier}
        mode={custom.cart.mode}
        track={!isPreview}
      >
      <div
        style={vars}
        data-zawya-store
        className="min-h-screen-safe flex flex-col"
        // لون النص والخلفية من المتجر لا من المنصة
      >
        <div style={{ background: 'var(--sf-bg)', color: 'var(--sf-text)' }} className="flex min-h-full flex-1 flex-col">
          <PreviewBridge />
          <StorePixels pixels={pixels} preview={isPreview} />
          {/* التاجر بيعاين متجره كتير — لو قِسنا زياراته، أرقامه تبقى كذب */}
          {!isPreview && <Tracker storeIdentifier={identifier} />}

          {custom.preloader.enabled && (
            <StorePreloader
              settings={custom.preloader}
              logo={storeLogo}
              storeName={store.name}
              preview={isPreview}
            />
          )}

          <AnnouncementBar settings={custom.announcement} />
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
            cartFreeShippingBar={custom.cart.freeShippingBar}
            cartFreeOver={custom.cart.freeShippingThreshold}
            cartShowNotes={custom.cart.showNotes}
            cartUpsell={cartUpsell}
            cartUpsellTitle={custom.cart.upsellTitle}
            showWishlist={custom.header.showWishlist}
            logoHeight={custom.header.logoHeight}
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

          <StoreToolbar
            toolbar={custom.toolbar}
            bot={
              botReady
                ? {
                    storeIdentifier: identifier,
                    greeting:
                      ai.botGreeting?.trim() ||
                      `أهلًا بيك في ${store.name}! اسألني عن أي منتج وأنا أساعدك.`,
                    accent: custom.identity.primary,
                  }
                : null
            }
          />

          {custom.toolbar.mobileNavEnabled && (
            <MobileNav showAccount={custom.header.showAccount} showCart={custom.header.showCart} />
          )}

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
