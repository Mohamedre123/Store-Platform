import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { PageHeader } from '@/components/dashboard/page-shell'
import { ProductForm } from '../product-form'

export const metadata = { title: 'منتج جديد' }

export default async function NewProductPage() {
  const { store } = await getDashboardContext()

  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(eq(categories.storeId, store.id))
    .orderBy(asc(categories.sortOrder))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title="منتج جديد" description="املأ البيانات وارفع الصور، وهيظهر في متجرك." />
      <ProductForm categories={cats} currency={store.currency} />
    </div>
  )
}
