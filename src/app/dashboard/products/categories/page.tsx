import Link from 'next/link'
import { asc, count, eq } from 'drizzle-orm'
import { ArrowRight } from 'lucide-react'
import { db } from '@/db'
import { categories, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { CategoriesManager } from './categories-manager'

export const metadata = { title: 'الأقسام' }

export default async function CategoriesPage() {
  const { store } = await getDashboardContext()

  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      description: categories.description,
      image: categories.image,
      isActive: categories.isActive,
      productCount: count(products.id),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(eq(categories.storeId, store.id))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="الأقسام"
        description="قسّم منتجاتك عشان العميل يلاقي اللي بيدوّر عليه بسرعة."
        action={
          <Link
            href="/dashboard/products"
            className="zw-lift inline-flex min-h-11 items-center gap-2 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            المنتجات
          </Link>
        }
      />
      <Reveal>
        <CategoriesManager initial={rows} />
      </Reveal>
    </div>
  )
}
