import { notFound } from 'next/navigation'
import { Package } from 'lucide-react'
import { getCategoryBySlug, getStore, getStoreTheme, listProducts } from '@/lib/storefront'
import { ProductCard } from '@/components/storefront/product-card'

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ store: string; slug: string }> }) {
  const { store: identifier, slug } = await params
  const store = await getStore(identifier)
  if (!store) return { title: 'القسم' }
  const category = await getCategoryBySlug(store.id, slug)
  return { title: category?.name ?? 'القسم' }
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ store: string; slug: string }>
}) {
  const { store: identifier, slug } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const category = await getCategoryBySlug(store.id, slug)
  if (!category) notFound()

  const theme = await getStoreTheme(store.id)
  const { layout } = theme.definition
  const items = await listProducts(store.id, { categoryId: category.id, limit: 60 })

  const gridClass =
    layout.card === 'compact'
      ? 'grid gap-3 sm:grid-cols-2'
      : layout.columns === 2
        ? 'grid grid-cols-2 gap-4 sm:gap-6'
        : 'grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4'

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{category.name}</h1>
      {category.description && <p className="mt-2 max-w-2xl opacity-70">{category.description}</p>}

      <div className="mt-8">
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
                style={layout.card}
                imageRatio={layout.imageRatio}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
