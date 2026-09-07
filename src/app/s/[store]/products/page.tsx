import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { Package } from 'lucide-react'
import { countProducts, getStore, getStoreTheme, listCategories, listProducts, listingGrid, marketCurrency, priceForMarket } from '@/lib/storefront'
import { parseSort } from '@/lib/sort-options'
import { ProductCard } from '@/components/storefront/product-card'
import { loadProductOptions } from '@/lib/product-options'
import { ListingControls } from '@/components/storefront/listing-controls'
import { Pagination } from '@/components/storefront/pagination'
import { makeT } from '@/lib/i18n'

export const dynamic = 'force-dynamic'
/**
 * الوسم بلغة الزائر.
 *
 * `metadata` الثابتة كانت بتكتب «كل المنتجات» في تبويب المتصفح مهما
 * كانت لغة الصفحة — واللي فاتح المتجر إنجليزي وشايف عنوان عربي
 * بيفتكر إنه فتح صفحة غلط. والوسم ده بيروح لجوجل كمان.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string }>
}) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  return { title: makeT(store?.locale ?? 'ar')('nav.products') }
}

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>
  searchParams: Promise<{ sort?: string; page?: string }>
}) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const t = makeT(store.locale)

  const isPreview = (await headers()).get('x-zawya-preview') === '1'
  const theme = await getStoreTheme(store.id, isPreview)
  const { listing } = theme.custom
  const query = await searchParams
  const sort = parseSort(query.sort)

  /**
   * الترقيم.
   *
   * الصفحة كانت بتجيب أول `perPage` منتج **وبس** — يعني متجر بمية
   * منتج بيعرض ٢٤ والباقي مالوش أي طريق يتوصّل بيه من هنا. ده كان
   * عطلًا بيخفي بضاعة التاجر عن عملائه، مش إعدادًا ناقصًا.
   *
   * ورقم الصفحة بيتقرا من الرابط: بيتشارك وبيترجع له وبيتفهرس.
   */
  const perPage = listing.perPage || 24
  const page = Math.max(1, Math.floor(Number(query.page) || 1))

  const [items, cats, total] = await Promise.all([
    listProducts(store.id, { limit: perPage, offset: (page - 1) * perPage, sort }).then((r) =>
      priceForMarket(r, store),
    ),
    listing.showCategoryFilter ? listCategories(store.id) : Promise.resolve([]),
    countProducts(store.id),
  ])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  /*
    رقم صفحة أكبر من الموجود بيرجّع ٤٠٤ لا صفحة فاضية.

    الرابط ‎?page=99‎ على متجر بصفحتين مش موجود فعلًا — وصفحة فاضية
    بترد ٢٠٠ بتخلّي جوجل يفهرس عشرات الصفحات الفاضية باسم المتجر.
  */
  if (page > totalPages && total > 0) notFound()

  /*
    خيارات المنتجات المعروضة — استعلام واحد للصفحة كلها.

    من غيرها العميل بيضيف تيشيرت بلا مقاس من هنا، ويكتشف إنه لازم
    يختار بعد ما يوصل السلة. المنتج البسيط ما بيرجّعش حاجة، فالصفحة
    اللي مالهاش خيارات ما بتدفعش تمن حاجة.
  */
  const optionSets = await loadProductOptions(
    store.id,
    items.map((p) => p.id),
  )

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">{t('nav.products')}</h1>

      <ListingControls
        showSort={listing.showSort}
        showCategoryFilter={listing.showCategoryFilter}
        categories={cats.map((c) => ({ name: t.pick(c.name, c.nameEn), slug: c.slug }))}
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Package className="h-10 w-10 opacity-25" aria-hidden="true" />
          <p className="opacity-65">{t('empty.products')}</p>
        </div>
      ) : (
        <div className={listingGrid(listing)}>
          {items.map((p) => (
            <ProductCard
              key={p.id}
              optionSet={optionSets.get(p.id)}
              action="choose"
              product={p}
              currency={marketCurrency(store)}
              locale={store.locale}
              style={listing.cardStyle}
              imageRatio={listing.imageRatio}
              showRating={listing.showRating}
              showQuickAdd={listing.showQuickAdd}
            />
          ))}
        </div>
      )}

      <Pagination page={page} totalPages={totalPages} basePath="/products" params={{ sort: query.sort }} />
    </div>
  )
}
