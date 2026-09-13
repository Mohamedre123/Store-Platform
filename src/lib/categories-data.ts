import 'server-only'
import { asc, count, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories, products } from '@/db/schema'

/**
 * أقسام المتجر بعدد منتجات كل قسم — صفحة اللوحة
 * (`/dashboard/products/categories`) وتطبيق الموبايل (`/api/app/categories`).
 */
export async function loadCategories(storeId: string) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      description: categories.description,
      image: categories.image,
      isActive: categories.isActive,
      parentId: categories.parentId,
      productCount: count(products.id),
    })
    .from(categories)
    .leftJoin(products, eq(products.categoryId, categories.id))
    .where(eq(categories.storeId, storeId))
    .groupBy(categories.id)
    .orderBy(asc(categories.sortOrder))
}
