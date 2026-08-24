import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import {
  getActiveBanners,
  getStore,
  getStoreTheme,
  listCategories,
  listProducts,
} from '@/lib/storefront'
import { loadHomeProducts } from '@/lib/home-blocks'
import { legacySource, readBlock, renderType } from '@/lib/blocks'
import type { Section } from '@/db/schema'
import { Hero } from '@/components/storefront/hero'
import { PromoBanner } from '@/components/storefront/promo-banner'
import { BannerBlockView } from '@/components/storefront/blocks/banner'
import { CategoriesBlockView } from '@/components/storefront/blocks/categories'
import { CountdownBlockView } from '@/components/storefront/blocks/countdown'
import { EmptyStore, ProductsBlockView } from '@/components/storefront/blocks/products'
import { SlidesBlockView } from '@/components/storefront/blocks/slides'
import { NewsletterBlockView } from '@/components/storefront/blocks/newsletter'
import {
  FaqBlockView,
  FeaturesBlockView,
  GalleryBlockView,
  LogosBlockView,
  RichTextBlockView,
  TestimonialsBlockView,
  VideoBlockView,
} from '@/components/storefront/blocks/content'
import type { BlockChrome } from '@/components/storefront/blocks/shell'

export const dynamic = 'force-dynamic'

/**
 * الصفحة الرئيسية.
 *
 * بترسم **البلوكات اللي التاجر ركّبها، بترتيبها**. مفيش أي قسم
 * مكتوب في الكود: البلوك ونوعه وإعداداته وترتيبه كلهم بيجوا من
 * `homeSections`، والتاجر يقدر يحطّ نفس النوع أكتر من مرة بإعدادات
 * مختلفة — قسمين منتجات، تلات بانرات، عرضين بعدّاد.
 *
 * الترتيب الافتراضي بيشتغل للمتاجر اللي لسه ما ركّبتش حاجة: صفحة
 * فاضية أسوأ من صفحة جاهزة يعدّل عليها.
 */

/** ترتيب معقول لمتجر لسه ما اتظبطش */
const DEFAULT_BLOCKS: Section[] = [
  { id: 'd-cats', type: 'categories', enabled: true, settings: {} },
  { id: 'd-featured', type: 'products', enabled: true, settings: { source: 'featured', title: 'منتجات مختارة' } },
  { id: 'd-sale', type: 'products', enabled: true, settings: { source: 'sale', title: 'التخفيضات' } },
  { id: 'd-new', type: 'products', enabled: true, settings: { source: 'new', title: 'وصل حديثًا' } },
  { id: 'd-features', type: 'features', enabled: true, settings: {} },
]

export default async function StoreHomePage({ params }: { params: Promise<{ store: string }> }) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const isPreview = (await headers()).get('x-zawya-preview') === '1'
  const theme = await getStoreTheme(store.id, isPreview)

  const saved = theme.sections.filter((s) => s.enabled)
  const blocks = saved.length > 0 ? saved : DEFAULT_BLOCKS

  const [cats, anyProduct, promos] = await Promise.all([
    listCategories(store.id),
    listProducts(store.id, { limit: 1 }),
    getActiveBanners(store.id, 'promo'),
  ])

  const home = await loadHomeProducts(store.id, blocks, anyProduct.length > 0)

  /* البانر الرئيسي بيفضل ثابتًا فوق — هو أول حاجة العميل بيشوفها */
  const heroOn = saved.length === 0 || saved.some((s) => s.type === 'hero')

  const chrome: BlockChrome = { effects: theme.custom.effects, order: 0 }
  const listing = theme.custom.listing

  /*
    القسم اللي زر «المزيد» بتاعه بيوديه: القسم المختار لو البلوك
    بيعرض قسمًا، وإلا كل المنتجات. الزر اللي بيرجّع العميل لنفس
    المنتجات اللي شايفها بيضيّع الضغطة.
  */
  const moreHrefFor = (categoryId: string | null, custom: string) => {
    if (custom.trim()) return custom.trim()
    const cat = categoryId ? cats.find((c) => c.id === categoryId) : null
    return cat ? `/category/${cat.slug}` : '/products'
  }

  return (
    <>
      {heroOn && (
        <Hero
          hero={theme.hero}
          storeName={store.name}
          tagline={store.tagline}
          fallbackStyle={theme.definition.layout.hero}
        />
      )}

      {!home.hasAnyProduct ? (
        <EmptyStore />
      ) : (
        blocks.map((section, index) => {
          const type = renderType(section.type)
          const c: BlockChrome = { ...chrome, order: heroOn ? index + 1 : index }

          switch (type) {
            case 'hero':
            case 'announcement':
              /* الاتنين بيترسموا في الـlayout مش هنا */
              return null

            case 'products': {
              const block = readBlock('products', section.settings)
              const forced = legacySource(section.type)
              const resolved = forced && !section.settings?.source ? { ...block, source: forced } : block

              return (
                <ProductsBlockView
                  key={section.id}
                  block={resolved}
                  products={home.productsByBlock.get(section.id) ?? []}
                  currency={store.currency}
                  listing={listing}
                  chrome={c}
                  moreHref={moreHrefFor(resolved.categoryId, resolved.moreUrl)}
                />
              )
            }

            case 'categories':
              return (
                <CategoriesBlockView
                  key={section.id}
                  block={readBlock('categories', section.settings)}
                  categories={cats}
                  chrome={c}
                  radiusFull={theme.tokens.radius === 'full'}
                />
              )

            case 'banner':
              return <BannerBlockView key={section.id} block={readBlock('banner', section.settings)} chrome={c} />

            case 'slides':
              return <SlidesBlockView key={section.id} block={readBlock('slides', section.settings)} />

            case 'countdown':
              return <CountdownBlockView key={section.id} block={readBlock('countdown', section.settings)} />

            case 'rich_text':
              return <RichTextBlockView key={section.id} block={readBlock('rich_text', section.settings)} chrome={c} />

            case 'features':
              return <FeaturesBlockView key={section.id} block={readBlock('features', section.settings)} chrome={c} />

            case 'testimonials':
              return (
                <TestimonialsBlockView
                  key={section.id}
                  block={readBlock('testimonials', section.settings)}
                  chrome={c}
                />
              )

            case 'faq':
              return <FaqBlockView key={section.id} block={readBlock('faq', section.settings)} chrome={c} />

            case 'video':
              return <VideoBlockView key={section.id} block={readBlock('video', section.settings)} chrome={c} />

            case 'logos':
              return <LogosBlockView key={section.id} block={readBlock('logos', section.settings)} chrome={c} />

            case 'gallery':
              return <GalleryBlockView key={section.id} block={readBlock('gallery', section.settings)} chrome={c} />

            case 'newsletter':
              return (
                <NewsletterBlockView
                  key={section.id}
                  block={readBlock('newsletter', section.settings)}
                  storeIdentifier={identifier}
                />
              )

            case 'promo_banners':
              /* البانرات القديمة — من صفحة البانرات المستقلة */
              return promos.length > 0 ? (
                <section key={section.id} className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
                  <div className="flex flex-col gap-4">
                    {promos.map((b) => (
                      <PromoBanner key={b.id} banner={b} />
                    ))}
                  </div>
                </section>
              ) : null

            default:
              return null
          }
        })
      )}

      {/*
        البانرات الترويجية بتظهر برّه الترتيب لو التاجر ما ضافش بلوكًا
        ليها — عرض شغّال دلوقتي أهم من ترتيب مثالي.
      */}
      {home.hasAnyProduct &&
        promos.length > 0 &&
        !blocks.some((b) => b.type === 'promo_banners') && (
          <section className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
            <div className="flex flex-col gap-4">
              {promos.map((b) => (
                <PromoBanner key={b.id} banner={b} />
              ))}
            </div>
          </section>
        )}
    </>
  )
}
