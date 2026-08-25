import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { Package } from 'lucide-react'
import { getStore, getStoreTheme, listCategories, listProducts, listingGrid } from '@/lib/storefront'
import { parseSort } from '@/lib/sort-options'
import { ProductCard } from '@/components/storefront/product-card'
import { loadProductOptions } from '@/lib/product-options'
import { ListingControls } from '@/components/storefront/listing-controls'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'كل المنتجات' }

export default async function ProductsPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>
  searchParams: Promise<{ sort?: string }>
}) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const isPreview = (await headers()).get('x-zawya-preview') === '1'
  const theme = await getStoreTheme(store.id, isPreview)
  const { listing } = theme.custom
  const sort = parseSort((await searchParams).sort)

  const [items, cats] = await Promise.all([
    listProducts(store.id, { limit: listing.perPage || 60, sort }),
    listing.showCategoryFilter ? listCategories(store.id) : Promise.resolve([]),
  ])

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
      <h1 className="mb-6 text-2xl font-bold tracking-tight sm:text-3xl">كل المنتجات</h1>

      <ListingControls
        showSort={listing.showSort}
        showCategoryFilter={listing.showCategoryFilter}
        categories={cats.map((c) => ({ name: c.name, slug: c.slug }))}
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Package className="h-10 w-10 opacity-25" aria-hidden="true" />
          <p className="opacity-65">مافيش منتجات معروضة دلوقتي.</p>
        </div>
      ) : (
        <div className={listingGrid(listing)}>
          {items.map((p) => (
            <ProductCard
              key={p.id}
              optionSet={optionSets.get(p.id)}
              action="choose"
              product={p}
              currency={store.currency}
              style={listing.cardStyle}
              imageRatio={listing.imageRatio}
              showRating={listing.showRating}
              showQuickAdd={listing.showQuickAdd}
            />
          ))}
        </div>
      )}
    </div>
  )
}
