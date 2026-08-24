import Image from 'next/image'
import { headers } from 'next/headers'
import { SLink as Link } from '@/components/storefront/store-link'
import { notFound } from 'next/navigation'
import { CreditCard, Package, RotateCcw, Truck } from 'lucide-react'
import { getActiveBanners, getStore, getStoreTheme, listCategories, listProducts, listingGrid } from '@/lib/storefront'
import { ProductCard } from '@/components/storefront/product-card'
import { Hero } from '@/components/storefront/hero'
import { PromoBanner } from '@/components/storefront/promo-banner'

export const dynamic = 'force-dynamic'

/* ────────────────────────── عناوين الأقسام ────────────────────────── */

function SectionHead({ title, href }: { title: string; href?: string }) {
  return (
    <div className="mb-6 flex items-baseline justify-between gap-4">
      <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
      {href && (
        <Link href={href} className="shrink-0 text-sm font-medium text-[var(--sf-primary)] hover:underline">
          عرض الكل
        </Link>
      )}
    </div>
  )
}

/* ────────────────────────── الصفحة ────────────────────────── */

export default async function StoreHomePage({ params }: { params: Promise<{ store: string }> }) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const isPreview = (await headers()).get('x-zawya-preview') === '1'
  const theme = await getStoreTheme(store.id, isPreview)
  const { listing } = theme.custom
  const cols = listing.columnsDesktop

  const enabled = new Set(theme.sections.filter((s) => s.enabled).map((s) => s.type))
  // لو التاجر ما رتّبش أقسامًا بعد، نعرض الأساسي بدل صفحة فاضية
  const show = (type: string) => (theme.sections.length === 0 ? true : enabled.has(type))

  const [cats, featured, latest, onSale, promos] = await Promise.all([
    listCategories(store.id),
    listProducts(store.id, { featured: true, limit: cols * 2 }),
    listProducts(store.id, { limit: cols * 2 }),
    listProducts(store.id, { onSale: true, limit: cols }),
    getActiveBanners(store.id, 'promo'),
  ])

  const gridClass = listingGrid(listing)
  const cardProps = {
    currency: store.currency,
    style: listing.cardStyle,
    imageRatio: listing.imageRatio,
    showRating: listing.showRating,
    showQuickAdd: listing.showQuickAdd,
  }

  const empty = latest.length === 0

  /**
   * أقسام الصفحة بترسم **بالترتيب اللي التاجر حفظه**.
   *
   * قبل كده كان الترتيب مكتوبًا في الكود، والإعداد بيتقرا عشان
   * «مفعّل ولا لأ» بس — فالتاجر بينقل «المنتجات» فوق «الأقسام»،
   * بيتحفظ فعلًا، وبيفتح متجره ويلاقيه زي ما هو. الحفظ كان شغّال
   * والعرض هو اللي مكانش بيقرا.
   *
   * كل قسم عقدة في الخريطة دي، والترتيب بييجي من مصفوفة الإعدادات.
   */
  const blocks: Record<string, React.ReactNode> = {
    categories: cats.length > 0 && (
      <section key="categories" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <SectionHead title="تسوّق حسب القسم" />
        <div className="scroll-x flex gap-4 pb-2 sm:grid sm:grid-cols-4 lg:grid-cols-6">
          {cats.map((c) => (
            <Link
              key={c.id}
              href={`/category/${c.slug}`}
              className="group flex w-28 shrink-0 flex-col items-center gap-2 sm:w-auto"
            >
              <span
                className={`relative aspect-square w-full overflow-hidden bg-[var(--sf-text)]/6 ${
                  theme.tokens.radius === 'full' ? 'rounded-full' : 'rounded-[var(--sf-radius)]'
                }`}
              >
                {c.image ? (
                  <Image src={c.image} alt="" fill sizes="120px" className="object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <span className="flex h-full items-center justify-center opacity-25">
                    <Package className="h-6 w-6" aria-hidden="true" />
                  </span>
                )}
              </span>
              <span className="text-center text-sm font-medium">{c.name}</span>
            </Link>
          ))}
        </div>
      </section>
    ),

    promo_banners: promos.length > 0 && (
      <section key="promo_banners" className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4">
          {promos.map((b) => (
            <PromoBanner key={b.id} banner={b} />
          ))}
        </div>
      </section>
    ),

    featured_products: featured.length > 0 && (
      <section key="featured_products" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <SectionHead title="منتجات مختارة" href="/products" />
        <div className={gridClass}>
          {featured.map((p) => (
            <ProductCard key={p.id} product={p} {...cardProps} />
          ))}
        </div>
      </section>
    ),

    sale_products: onSale.length > 0 && (
      <section key="sale_products" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <SectionHead title="التخفيضات" href="/products" />
        <div className={gridClass}>
          {onSale.map((p) => (
            <ProductCard key={p.id} product={p} {...cardProps} />
          ))}
        </div>
      </section>
    ),

    new_arrivals: (
      <section key="new_arrivals" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <SectionHead title="وصل حديثًا" href="/products" />
        <div className={gridClass}>
          {latest.map((p) => (
            <ProductCard key={p.id} product={p} {...cardProps} />
          ))}
        </div>
      </section>
    ),

    all_products: latest.length > 0 && (
      <section key="all_products" className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <SectionHead title="كل المنتجات" href="/products" />
        <div className={gridClass}>
          {latest.map((p) => (
            <ProductCard key={p.id} product={p} {...cardProps} />
          ))}
        </div>
      </section>
    ),

    trust_badges: (
      <section key="trust_badges" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="grid grid-cols-2 gap-4 border-t border-[var(--sf-text)]/10 pt-8 md:grid-cols-4">
          {[
            { icon: Truck, t: 'شحن سريع', d: 'لكل المحافظات' },
            { icon: CreditCard, t: 'دفع عند الاستلام', d: 'ادفع لما يوصلك' },
            { icon: RotateCcw, t: 'إرجاع سهل', d: 'لو المنتج مش زي ما توقّعت' },
            { icon: Package, t: 'تغليف آمن', d: 'يوصلك بحالته' },
          ].map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex flex-col items-center gap-1.5 text-center">
              <Icon className="h-6 w-6 text-[var(--sf-primary)]" aria-hidden="true" />
              <span className="text-sm font-semibold">{t}</span>
              <span className="text-xs opacity-60">{d}</span>
            </div>
          ))}
        </div>
      </section>
    ),
  }

  /*
    الترتيب المحفوظ، ولو التاجر لسه ما رتّبش حاجة بنرجع لترتيب
    افتراضي معقول بدل صفحة فاضية.
  */
  const DEFAULT_ORDER = [
    'categories',
    'promo_banners',
    'featured_products',
    'sale_products',
    'new_arrivals',
    'trust_badges',
  ]

  const ordered =
    theme.sections.length > 0
      ? theme.sections.filter((sec) => sec.enabled).map((sec) => sec.type)
      : DEFAULT_ORDER

  return (
    <>
      {show('hero') && (
        <Hero
          hero={theme.hero}
          storeName={store.name}
          tagline={store.tagline}
          fallbackStyle={theme.definition.layout.hero}
        />
      )}

      {empty ? (
        <section className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
          <Package className="h-10 w-10 opacity-25" aria-hidden="true" />
          <h2 className="text-lg font-bold">لسه مافيش منتجات</h2>
          <p className="opacity-65">المتجر بيتجهّز. ارجع تاني قريب.</p>
        </section>
      ) : (
        ordered.map((type) => blocks[type] ?? null)
      )}

      {/*
        البانرات بتظهر برّه الترتيب كمان لو التاجر ما ضافش قسمًا ليها —
        العرض اللي شغّال دلوقتي أهم من ترتيب مثالي.
      */}
      {!ordered.includes('promo_banners') && promos.length > 0 && blocks.promo_banners}
    </>
  )
}
