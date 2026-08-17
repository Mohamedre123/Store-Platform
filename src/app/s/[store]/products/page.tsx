import { notFound } from 'next/navigation'
import { Package } from 'lucide-react'
import { getStore, getStoreTheme, listProducts } from '@/lib/storefront'
import { ProductCard } from '@/components/storefront/product-card'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'كل المنتجات' }

export default async function ProductsPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const theme = await getStoreTheme(store.id)
  const { layout } = theme.definition
  const items = await listProducts(store.id, { limit: 60 })

  const gridClass =
    layout.card === 'compact'
      ? 'grid gap-3 sm:grid-cols-2'
      : layout.columns === 2
        ? 'grid grid-cols-2 gap-4 sm:gap-6'
        : 'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4'

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">كل المنتجات</h1>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Package className="h-10 w-10 opacity-25" aria-hidden="true" />
          <p className="opacity-65">مافيش منتجات معروضة دلوقتي.</p>
        </div>
      ) : (
        <div className={gridClass}>
          {items.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              currency={store.currency}
              style={layout.card}
              imageRatio={layout.imageRatio}
            />
          ))}
        </div>
      )}
    </div>
  )
}
