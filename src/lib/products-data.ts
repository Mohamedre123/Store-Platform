import 'server-only'
import { and, desc, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { categories, products } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import { loadProductVariants } from '@/lib/variants'

/**
 * بيانات المنتجات — مصدر واحد لصفحة المنتجات في اللوحة ولتطبيق الموبايل.
 *
 * ## المحذوف مش هنا
 * الحذف ناعم: المنتج بيتختم بـ`deletedAt` وبيروح لسلة المهملات. القايمة
 * كانت بتجيب كل صفوف المتجر، فالمنتج المحذوف كان بيفضل ظاهر فيها بشارة
 * «مسوّدة» — والتاجر يفتكر إن الحذف ما اشتغلش. سلة المهملات ليها صفحتها.
 */

export async function loadProductsList(store: ActiveStore) {
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
    .where(and(eq(products.storeId, store.id), isNull(products.deletedAt)))
    .orderBy(desc(products.createdAt))

  const active = rows.filter((r) => r.status === 'active').length
  const lowStock = rows.filter((r) => r.trackInventory && r.stock <= 5).length

  return { rows, active, lowStock }
}

/** منتج واحد بقسمه ومتغيّراته — لشاشة المنتج في التطبيق */
export async function loadProductDetail(store: ActiveStore, productId: string) {
  const [row] = await db
    .select({ product: products, categoryName: categories.name })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(eq(products.id, productId), eq(products.storeId, store.id), isNull(products.deletedAt)))
    .limit(1)

  if (!row) return null

  const variants = await loadProductVariants(row.product.id)
  return { product: row.product, categoryName: row.categoryName, variants }
}
