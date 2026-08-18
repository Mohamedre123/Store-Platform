import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { Search } from 'lucide-react'
import { getStore, getStoreTheme, listingGrid, searchProducts } from '@/lib/storefront'
import { ProductCard } from '@/components/storefront/product-card'
import { SearchBox } from '@/components/storefront/search-box'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'البحث' }

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string }>
  searchParams: Promise<{ q?: string }>
}) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const q = (await searchParams).q?.trim() ?? ''
  const isPreview = (await headers()).get('x-zawya-preview') === '1'
  const theme = await getStoreTheme(store.id, isPreview)
  const { listing } = theme.custom

  const results = q ? await searchProducts(store.id, q, listing.perPage || 40) : []

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-5 text-2xl font-bold tracking-tight">البحث</h1>

      <div className="mb-8 max-w-lg">
        <SearchBox initialQuery={q} autoFocus />
      </div>

      {!q ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Search className="h-10 w-10 opacity-25" aria-hidden="true" />
          <p className="opacity-65">اكتب اسم المنتج اللي بتدوّر عليه.</p>
        </div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Search className="h-10 w-10 opacity-25" aria-hidden="true" />
          <p className="font-medium">مالقيناش نتايج لـ«{q}»</p>
          <p className="text-sm opacity-65">جرّب كلمة تانية أو تصفّح كل المنتجات.</p>
        </div>
      ) : (
        <>
          <p className="mb-5 text-sm opacity-65">
            {results.length} نتيجة لـ«{q}»
          </p>
          <div className={listingGrid(listing)}>
            {results.map((p) => (
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
        </>
      )}
    </div>
  )
}
