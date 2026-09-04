import { notFound } from 'next/navigation'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { ProductForm } from '../product-form'
import { DeleteProduct } from '../delete-product'
import { loadProductVariants, toEditorVariants } from '@/lib/variants'
import { listPickerCategories } from '../../storefront/picker-actions'

export const metadata = { title: 'تعديل المنتج' }

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { store, actor } = await getDashboardContext()
  guard(actor, 'products.view')

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.storeId, store.id)))
    .limit(1)

  if (!product) notFound()

  const [cats, saved, pickerCategories] = await Promise.all([
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.storeId, store.id))
      .orderBy(asc(categories.sortOrder)),
    loadProductVariants(product.id),
    listPickerCategories(),
  ])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={product.name} description="عدّل بيانات المنتج." action={<DeleteProduct id={product.id} />} />
      <ProductForm
        product={{
          id: product.id,
          name: product.name,
          description: product.description,
          brand: product.brand,
          seoTitle: product.seoTitle,
          seoDescription: product.seoDescription,
          slug: product.slug,
          categoryId: product.categoryId,
          price: product.price,
          compareAtPrice: product.compareAtPrice,
          costPrice: product.costPrice,
          sku: product.sku,
          stock: product.stock,
          trackInventory: product.trackInventory,
          status: product.status,
          images: product.images,
          relatedProductIds: product.relatedProductIds ?? [],
          upsellProductIds: product.upsellProductIds ?? [],
        }}
        categories={cats}
        pickerCategories={pickerCategories}
        currency={store.currency}
        storeName={store.name}
        variants={{
          options: saved.options.map((o) => ({
            name: o.name,
            displayAs: o.displayAs,
            values: o.values.map((v) => ({ value: v.value, hex: v.hex })),
          })),
          variants: toEditorVariants(saved.variants),
        }}
      />
    </div>
  )
}
