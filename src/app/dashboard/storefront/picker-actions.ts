'use server'

import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { categories, pages, products } from '@/db/schema'
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

/* ────────────────────────── وجهات الروابط ────────────────────────── */

export type LinkTarget = { value: string; label: string; group: string }

/**
 * الأماكن اللي زر في المتجر ممكن يوديها.
 *
 * التاجر كان بيكتب المسار بإيده — `/category/رجالي` — وأي حرف غلط
 * بيوصّل العميل لصفحة مش موجودة، والتاجر ما بيكتشفش غير لما حد
 * يشتكي. وأصلًا مين يعرف إن مسار القسم بيبدأ بـ`category/`؟
 *
 * هنا بيختار من قايمة بأسماء يعرفها، وإحنا بنبني المسار الصح.
 * وسايبين «رابط مخصّص» لأي حاجة برّه المتجر (صفحة إعلان، واتساب،
 * قناة تيليجرام).
 */
export async function listLinkTargets(): Promise<LinkTarget[]> {
  const { store } = await getDashboardContext()

  const [cats, pageRows] = await Promise.all([
    db
      .select({ name: categories.name, slug: categories.slug, parentId: categories.parentId })
      .from(categories)
      .where(and(eq(categories.storeId, store.id), eq(categories.isActive, true)))
      .orderBy(categories.sortOrder),

    db
      .select({ title: pages.title, slug: pages.slug })
      .from(pages)
      .where(and(eq(pages.storeId, store.id), eq(pages.isPublished, true)))
      .orderBy(pages.title),
  ])

  return [
    { value: '/', label: 'الصفحة الرئيسية', group: 'المتجر' },
    { value: '/products', label: 'كل المنتجات', group: 'المتجر' },
    { value: '/blog', label: 'المدوّنة', group: 'المتجر' },
    { value: '/cart', label: 'السلة', group: 'المتجر' },
    { value: '/account', label: 'حساب العميل', group: 'المتجر' },

    ...cats.map((c) => ({
      value: `/category/${c.slug}`,
      /* الفرعي بيبان تحت أبوه — الأسماء بتتكرر بين الأقسام كتير */
      label: c.parentId ? `‏— ${c.name}` : c.name,
      group: 'الأقسام',
    })),

    ...pageRows.map((p) => ({
      value: `/pages/${p.slug}`,
      label: p.title,
      group: 'الصفحات',
    })),
  ]
}
