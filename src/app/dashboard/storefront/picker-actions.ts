'use server'

import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { categories, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'

/**
 * بيانات منتقي المنتجات والأقسام في بنّاء الصفحة.
 *
 * كل استعلام هنا **مقيَّد بمتجر صاحب الجلسة**. الـid اللي بييجي من
 * المتصفح ما بيتوثقش فيه أبدًا: لو نسينا الشرط ده، تاجر يقدر يكتب
 * id منتج تاجر تاني ويعرضه في متجره — وده تسريب كتالوج بين متاجر.
 */

export type PickerProduct = {
  id: string
  name: string
  image: string | null
  price: number
  categoryName: string | null
  status: string
}

export type PickerCategory = {
  id: string
  name: string
  parentId: string | null
  productCount: number
}

const visible = (storeId: string) =>
  and(eq(products.storeId, storeId), sql`${products.deletedAt} is null`)

/** أقسام المتجر بترتيبها، ومعاها عدد منتجات كل قسم */
export async function listPickerCategories(): Promise<PickerCategory[]> {
  const { store } = await getDashboardContext()

  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, and(eq(products.categoryId, categories.id), eq(products.status, 'active')))
    .where(eq(categories.storeId, store.id))
    .groupBy(categories.id)
    .orderBy(categories.sortOrder)

  return rows
}

/**
 * منتجات للاختيار — بالبحث أو بالقسم.
 *
 * بترجّع المنتجات المخفية كمان ومعاها حالتها: التاجر بيدوّر على منتج
 * وما بيلاقهوش لأنه مسوّدة، ومش فاهم ليه. لما يشوفه ومعاه «مخفي»
 * بيعرف يعمل إيه.
 */
export async function searchPickerProducts(input: {
  query?: string
  categoryId?: string | null
  limit?: number
}): Promise<PickerProduct[]> {
  const { store } = await getDashboardContext()

  const conditions = [visible(store.id)]

  const q = input.query?.trim()
  if (q) {
    const like = `%${q}%`
    conditions.push(or(ilike(products.name, like), ilike(products.sku, like))!)
  }

  if (input.categoryId) conditions.push(eq(products.categoryId, input.categoryId))

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      images: products.images,
      price: products.price,
      status: products.status,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...conditions))
    .orderBy(desc(products.createdAt))
    .limit(Math.min(input.limit ?? 40, 60))

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    image: r.images?.[0] ?? null,
    price: r.price,
    status: r.status,
    categoryName: r.categoryName,
  }))
}

/**
 * المنتجات المختارة بالفعل — عشان المحرّر يعرضها بأسمائها وصورها.
 *
 * بترجّع بترتيب الـids اللي اتبعتوا: التاجر رتّبهم بعناية، والترتيب
 * اللي بترجّعه قاعدة البيانات مالوش علاقة بترتيبه.
 */
export async function resolvePickerProducts(ids: string[]): Promise<PickerProduct[]> {
  if (ids.length === 0) return []

  const { store } = await getDashboardContext()

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      images: products.images,
      price: products.price,
      status: products.status,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(visible(store.id), inArray(products.id, ids.slice(0, 48))))

  const byId = new Map(rows.map((r) => [r.id, r]))

  return ids
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((r) => ({
      id: r!.id,
      name: r!.name,
      image: r!.images?.[0] ?? null,
      price: r!.price,
      status: r!.status,
      categoryName: r!.categoryName,
    }))
}
