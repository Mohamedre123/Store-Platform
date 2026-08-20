import { notFound } from 'next/navigation'
import { decodeSlug } from '@/lib/utils'
import { headers } from 'next/headers'
import { Package } from 'lucide-react'
import {
  getCategoryBySlug,
  getStore,
  getStoreTheme,
  listCategories,
  listProducts,
  listingGrid,
} from '@/lib/storefront'
import { parseSort } from '@/lib/sort-options'
import { ProductCard } from '@/components/storefront/product-card'
import { ListingControls } from '@/components/storefront/listing-controls'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ store: string; slug: string }> }) {
  const { store: identifier, slug: rawSlug } = await params
  const slug = decodeSlug(rawSlug)
  const store = await getStore(identifier)
  if (!store) return { title: 'القسم' }
  const category = await getCategoryBySlug(store.id, slug)
  return { title: category?.name ?? 'القسم' }
}

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string; slug: string }>
  searchParams: Promise<{ sort?: string }>
}) {
  const { store: identifier, slug: rawSlug } = await params
  const slug = decodeSlug(rawSlug)
  const store = await getStore(identifier)
  if (!store) notFound()

  const category = await getCategoryBySlug(store.id, slug)
  if (!category) notFound()

  const isPreview = (await headers()).get('x-zawya-preview') === '1'
  const theme = await getStoreTheme(store.id, isPreview)
  const { listing } = theme.custom
  const sort = parseSort((await searchParams).sort)

  const [items, cats] = await Promise.all([
    listProducts(store.id, { categoryId: category.id, limit: listing.perPage || 60, sort }),
    listing.showCategoryFilter ? listCategories(store.id) : Promise.resolve([]),
  ])

  const gridClass = listingGrid(listing)

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{category.name}</h1>
      {category.description && <p className="mt-2 max-w-2xl opacity-70">{category.description}</p>}

      <div className="mt-8">
        <ListingControls
          showSort={listing.showSort}
          showCategoryFilter={listing.showCategoryFilter}
          categories={cats.map((c) => ({ name: c.name, slug: c.slug }))}
          activeCategory={slug}
        />
        {items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Package className="h-10 w-10 opacity-25" aria-hidden="true" />
            <p className="opacity-65">مافيش منتجات في القسم ده لسه.</p>
          </div>
        ) : (
          <div className={gridClass}>
            {items.map((p) => (
              <ProductCard
                key={p.id}
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
    </div>
  )
}
