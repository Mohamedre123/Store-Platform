import 'server-only'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/db'
import { products } from '@/db/schema'

/**
 * سلة مهملات المنتجات — صفحة اللوحة (`/dashboard/products/trash`) وتطبيق
 * الموبايل (`/api/app/trash`).
 */
export async function loadTrash(storeId: string) {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      price: products.price,
      images: products.images,
      deletedAt: products.deletedAt,
    })
    .from(products)
    .where(and(eq(products.storeId, storeId), isNotNull(products.deletedAt)))
    .orderBy(desc(products.deletedAt))
    .limit(200)

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    price: r.price,
    image: r.images?.[0] ?? null,
    deletedAt: r.deletedAt!.toISOString(),
  }))
}
