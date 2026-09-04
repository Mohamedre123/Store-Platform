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
import { StoreClosed } from '@/components/storefront/store-closed'
import { StoreFooter } from '@/components/storefront/footer'
import { StoreToolbar } from '@/components/storefront/store-toolbar'
import { MobileNav } from '@/components/storefront/mobile-nav'
import { AnnouncementBar } from '@/components/storefront/announcement-bar'
import { LuckyWheel } from '@/components/storefront/lucky-wheel'
import { getWheelConfig } from '@/lib/wheel'
import { aiAllowed, getAiConfig, isReady } from '@/lib/ai/settings'
import { StoreLinkProvider } from '@/components/storefront/store-link'
import { getCurrentCustomer } from '@/lib/customer-auth'
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

  /**
   * سيو التاجر بيغلب الافتراضي.
   *
   * الافتراضي «اسم المتجر» و«تسوّق من …» بيخلّي كل متاجر المنصة
   * نتايجها متشابهة في جوجل — ومفيش واحد فيهم بيوصف بضاعته. اللي
   * التاجر بيكتبه هنا هو اللي بيفرّقه.
   *
   * والعنوان بيفضل `absolute` عشان قالب المنصة ما يلزقش اسمنا على
   * علامة التاجر.
   */
  const seoTitle = store.seoTitle?.trim() || store.name
  const seoDescription =
    store.seoDescription?.trim() || store.tagline || `تسوّق من ${store.name}`
  const shareImage = store.ogImage ?? store.logoLight ?? undefined

  return {
    title: { absolute: seoTitle, template: `%s | ${store.name}` },
    description: seoDescription,
    keywords: store.seoKeywords?.trim() || undefined,
    /*
      الفهرسة بتتقفل وقت التجهيز.

      الصفحة الفاضية اللي اتفهرست بتفضل في نتايج جوجل شهور بعد ما
      تمتلي — والتاجر بيشتكي إن اسمه بيطلع بصفحة قديمة ومش عارف ليه.
    */
    robots: store.allowIndexing ? undefined : { index: false, follow: false },
    /*
      أيقونة التبويب: الأيقونة المخصّصة الأول، وبعدها الشعار.

      التاجر بيرفع «أيقونة المتصفح» من الإعدادات، وكانت بتتحفظ في
      قاعدة البيانات وخلاص — التبويب كان بياخد الشعار بدلها. والشعار
      عرضه أكبر من طوله عادةً، فبيتصغّر في مربّع ١٦×١٦ لخربشة مش
      باينة. عشان كده الحقل موجود من أصله.

      و`apple` مطلوبة لوحدها: سفاري بيتجاهل `icon` لما العميل يضيف
      المتجر لشاشة تليفونه الرئيسية، وبيحط لقطة من الصفحة مكانها.

      undefined هنا كان معناه «ورّث» — يعني أيقونة زاوية تظهر في تبويب
      متجر التاجر. القايمة الفاضية بتلغي الوراثة: التاجر من غير شعار
      ولا أيقونة ياخد أيقونة المتصفح العادية، أحسن من علامة حد تاني.
    */
    icons: (() => {
      const mark = store.favicon ?? store.logoLight
      return mark ? { icon: mark, shortcut: mark, apple: mark } : { icon: [] }
    })(),
    /*
      صورة المشاركة أهم من العنوان على واتساب.

      الرابط اللي بيتبعت في محادثة بيتحوّل لبطاقة، والصورة هي أكبر
      حاجة فيها. من غيرها الرابط بيبان سطر نص باهت — وده الفرق بين
      إن حد يدوس عليه ولا يعدّيه.
    */
    openGraph: {
      title: seoTitle,
      description: seoDescription,
      type: 'website',
      siteName: store.name,
      images: shareImage ? [shareImage] : undefined,
    },
    twitter: shareImage
      ? { card: 'summary_large_image', title: seoTitle, description: seoDescription, images: [shareImage] }
      : undefined,
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

  /**
   * المتجر مقفول — صيانة أو «قريبًا».
   *
   * ## المسارات اللي بتعدّي
   * صفحة تتبّع الطلب والفاتورة بيفضلوا شغّالين. العميل اللي دفع
   * ومستني شحنته مالوش دعوة بإن التاجر بيغيّر شكل متجره — وحجب
   * فاتورته عنه بيخلّيه يفتكر إن فلوسه ضاعت ويتصل يشتكي.
   *
   * وحساب العميل معاهم: هو الباب اللي بيوصل منه لطلباته.
   *
   * ## والمعاينة بتشوف المتجر عادي
   * التاجر اللي قافل متجره للصيانة لازم يفضل قادر يشوف شغله وهو
   * بيظبّطه — وإلا بيفتح ويقفل مع كل تعديل.
   */
  const closed = store.maintenanceMode
    ? ('maintenance' as const)
    : store.comingSoon
      ? ('coming_soon' as const)
      : null

  const alwaysOpen = /\/(order|account|invoice)(\/|$)/.test(path)

  if (closed && !isPreview && !alwaysOpen) {
    /*
      الثيم بس — من غير الأقسام والبكسل والعجلة والمساعد.

      الشاشة دي فيها شعار ورسالة وخانة بريد. تحميل باقي بيانات
      المتجر معناه خمس استعلامات على كل زيارة لصفحة مقفولة، والمتجر
      اللي بيعلن قبل ما يفتح ممكن يكون عليه ضغط أعلى من المفتوح.
    */
    const closedTheme = await getStoreTheme(store.id)
    const id = closedTheme.custom.identity

    return (
      <div
        style={
          {
            '--sf-primary': id.primary,
            '--sf-accent': id.accent,
            '--sf-bg': id.background,
            '--sf-surface': id.surface,
            '--sf-text': id.text,
            '--sf-radius': RADIUS_PX[id.radius],
            '--sf-font-heading': FONT_STACKS[id.fontHeading],
            '--sf-font-body': FONT_STACKS[id.fontBody],
            fontFamily: 'var(--sf-font-body)',
            background: id.background,
            color: id.text,
          } as React.CSSProperties
        }
      >
        <StoreClosed
          kind={closed}
          storeName={store.name}
          storeSlug={store.slug}
          logo={id.logoLight ?? store.logoLight}
          message={closed === 'maintenance' ? store.maintenanceMessage : store.comingSoonMessage}
        />
      </div>
    )
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
  /*
    العميل المسجَّل — بيروح للسلة عشان تفضل مقفولة على صاحبها.

    `getCurrentCustomer` مغلّفة بـcache فالنداء ده ما بيزوّدش رحلة:
    صفحات المتجر اللي بتحتاجه بتقرا نفس النتيجة في نفس الطلب.
  */

  const customer = await getCurrentCustomer(store.id)

  const ai = await getAiConfig(store.id)
  /*
    والاشتراك شرط تالت. من غيره الزائر بيلاقي أيقونة شات بتفتح
    وبتقول «المساعد مش مفعّل» — ده بيبان عطل في متجر التاجر، مش
    ميزة مقفولة عندنا.
  */
  const botReady =
    !isPreview && ai.botEnabled && isReady(ai) && (await aiAllowed(store.id))

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

  /**
   * روابط الهيدر.
   *
   * ## الأقسام مرة واحدة بس
   * شريط الأقسام لما بيبقى شغّال بيعرض الأقسام كلها في سطر تحت
   * الهيدر. وقايمة الهيدر كانت بتضيف أول أربعة كمان — فالقسم بيتكتب
   * مرتين فوق بعض، والعميل بيشوف نفس الكلمة في سطرين ورا بعض.
   *
   * فالأقسام بتدخل القايمة **لما ما يكونش فيه شريط** بس: الشريط
   * موجود عشانها، ووجوده بيغني عنها.
   */
  const showCategoriesBar = custom.header.showCategoriesBar && cats.length > 0

  const nav = [
    { label: 'الرئيسية', href: '/' },
    { label: 'كل المنتجات', href: '/products' },
    ...(showCategoriesBar
      ? []
      : cats.slice(0, 4).map((c) => ({ label: c.name, href: `/category/${c.slug}` }))),
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
    /*
      التمرير الناعم على الحاوية لا على `html`.
      لو حطّيناه على المستند كله كان هيأثّر على لوحة التاجر كمان
      وهو بيعاين، وعلى صفحات المنصة اللي مالهاش علاقة بإعداد المتجر.
    */
    ...(custom.effects.smoothScroll ? { scrollBehavior: 'smooth' as const } : {}),
  } as React.CSSProperties

  return (
    <StoreLinkProvider base={base}>
      <CartProvider
        storeSlug={store.slug}
        storeIdentifier={identifier}
        mode={custom.cart.mode}
        track={!isPreview}
        customerId={customer?.id ?? null}
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

          <StoreFooter
            footer={custom.footer}
            storeName={store.name}
            contact={{ phone: store.phone, whatsapp: store.whatsapp, social: store.socialLinks }}
            policyPages={policyPages}
          />

          <StoreToolbar
            toolbar={custom.toolbar}
            storeWhatsapp={store.whatsapp}
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
