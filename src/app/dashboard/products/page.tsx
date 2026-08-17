import Link from 'next/link'
import Image from 'next/image'
import { and, desc, eq } from 'drizzle-orm'
import { ImageOff, Layers, Package, Plus } from 'lucide-react'
import { db } from '@/db'
import { products, categories } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { formatMoney } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal, SpotlightCard } from '@/components/motion'
import { Card } from '@/components/ui'

export const metadata = { title: 'المنتجات' }

export default async function ProductsPage() {
  const { store } = await getDashboardContext()

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      compareAtPrice: products.compareAtPrice,
      stock: products.stock,
      trackInventory: products.trackInventory,
      status: products.status,
      images: products.images,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(eq(products.storeId, store.id))
    .orderBy(desc(products.createdAt))

  const active = rows.filter((r) => r.status === 'active').length
  const lowStock = rows.filter((r) => r.trackInventory && r.stock <= 5).length

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="المنتجات"
        description={`${rows.length} منتج · ${active} نشط${lowStock ? ` · ${lowStock} كميته قربت تخلص` : ''}`}
        action={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/dashboard/products/categories"
              className="zw-lift inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
            >
              <Layers className="h-4 w-4" aria-hidden="true" />
              الأقسام
            </Link>
            <Link
              href="/dashboard/products/new"
              className="zw-lift zw-press inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] shadow-sm"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              منتج جديد
            </Link>
          </div>
        }
      />

      {rows.length === 0 ? (
        <Reveal>
          <Card className="flex flex-col items-center gap-4 px-6 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--primary-soft)] text-[var(--primary)]">
              <Package className="h-6 w-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold">لسه مافيش منتجات</h2>
              <p className="mt-1 text-sm text-[var(--fg-muted)]">
                ضيف أول منتج وهيظهر في متجرك على طول.
              </p>
            </div>
            <Link
              href="/dashboard/products/new"
              className="zw-lift zw-press inline-flex min-h-11 items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              ضيف أول منتج
            </Link>
          </Card>
        </Reveal>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((p, i) => (
            <Reveal key={p.id} delay={(i % 3) * 60}>
              <Link href={`/dashboard/products/${p.id}`} className="block h-full">
                <SpotlightCard className="flex h-full gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-3">
                  <span className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                    {p.images[0] ? (
                      <Image src={p.images[0]} alt="" fill sizes="80px" className="object-cover" />
                    ) : (
                      <span className="flex h-full items-center justify-center text-[var(--fg-subtle)]">
                        <ImageOff className="h-5 w-5" aria-hidden="true" />
                      </span>
                    )}
                  </span>

                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                      {p.status !== 'active' && (
                        <span className="shrink-0 rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--fg-subtle)]">
                          مسوّدة
                        </span>
                      )}
                    </span>

                    {p.categoryName && (
                      <span className="text-xs text-[var(--fg-subtle)]">{p.categoryName}</span>
                    )}

                    <span className="mt-auto flex flex-wrap items-baseline gap-2">
                      <span className="tabular text-sm font-bold">
                        {formatMoney(p.price, store.currency)}
                      </span>
                      {p.compareAtPrice && (
                        <span className="tabular text-xs text-[var(--fg-subtle)] line-through">
                          {formatMoney(p.compareAtPrice, store.currency)}
                        </span>
                      )}
                    </span>

                    {p.trackInventory && (
                      <span
                        className={`text-xs ${
                          p.stock === 0
                            ? 'text-[var(--color-danger)]'
                            : p.stock <= 5
                              ? 'text-[var(--color-warning)]'
                              : 'text-[var(--fg-subtle)]'
                        }`}
                      >
                        {p.stock === 0 ? 'نفدت الكمية' : `متبقي ${p.stock}`}
                      </span>
                    )}
                  </span>
                </SpotlightCard>
              </Link>
            </Reveal>
          ))}
        </div>
      )}
    </div>
  )
}
