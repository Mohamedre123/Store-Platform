import 'server-only'
import { and, desc, eq, gt, inArray, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { categories, products } from '@/db/schema'
import type { Section } from '@/db/schema'
import { legacySource, readBlock, renderType, type ProductsBlock } from './blocks'
import type { StorefrontProduct } from './storefront'

/**
 * جلب بيانات بلوكات الصفحة الرئيسية.
 *
 * ## ليه ملف لوحده
 * الصفحة ممكن يكون فيها ست بلوكات منتجات. لو كل بلوك جاب منتجاته
 * لوحده، الطلبات بتتراصّ ورا بعض وكل واحد بياخد رحلة كاملة لقاعدة
 * البيانات — الصفحة بتاخد ثانية بدل ١٥٠ ملّي، والتاجر بيقول
 * «المتجر بطيء» وهو مضيّف بلوك زيادة بس.
 *
 * هنا بنقرا كل البلوكات، نجمّع طلباتها، وننفّذها **مع بعض**. الوقت
 * بيبقى وقت أبطأ استعلام لا مجموعهم.
 *
 * ## والتكرار
 * بلوكين بنفس المصدر ونفس القسم (وارد جدًا: «الجديد» فوق و«الجديد»
 * تحت بشكل تاني) بياخدوا نفس النتيجة من استعلام واحد.
 */

const productFields = {
  id: products.id,
  name: products.name,
  slug: products.slug,
  shortDescription: products.shortDescription,
  price: products.price,
  compareAtPrice: products.compareAtPrice,
  images: products.images,
  stock: products.stock,
  trackInventory: products.trackInventory,
  ratingSum: products.ratingSum,
  ratingCount: products.ratingCount,
  showStockCounter: products.showStockCounter,
  categoryName: categories.name,
}

const visible = (storeId: string) =>
  and(eq(products.storeId, storeId), eq(products.status, 'active'), sql`${products.deletedAt} is null`)

/** مفتاح الاستعلام — بلوكين بنفس الطلب بياخدوا نفس النتيجة */
function queryKey(block: ProductsBlock): string {
  if (block.source === 'manual') return `manual:${block.productIds.join(',')}`
  if (block.source === 'category') {
    return `cat:${block.categoryId ?? ''}:${block.includeChildren ? 'deep' : 'flat'}:${block.limit}`
  }
  return `${block.source}:${block.limit}`
}

async function runQuery(storeId: string, block: ProductsBlock): Promise<StorefrontProduct[]> {
  /*
    الاختيار اليدوي بيرجع **بترتيب التاجر**.

    قاعدة البيانات بترجّع الصفوف بترتيبها هي، فالتاجر اللي رتّب
    منتجاته بعناية كان بيلاقيهم مبعترين في متجره ويفتكر إن الترتيب
    ما اتحفظش. بنرتّبهم في الذاكرة بعد الجلب — القايمة صغيرة أصلًا.
  */
  if (block.source === 'manual') {
    const ids = block.productIds.slice(0, 48)
    if (ids.length === 0) return []

    const rows = await db
      .select(productFields)
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(visible(storeId), inArray(products.id, ids)))

    const byId = new Map(rows.map((r) => [r.id, r]))
    return ids.map((id) => byId.get(id)).filter(Boolean) as StorefrontProduct[]
  }

  const conditions = [visible(storeId)]

  if (block.source === 'category') {
    if (!block.categoryId) return []

    if (block.includeChildren) {
      /*
        القسم الأب بيعرض منتجات أولاده كمان — التاجر اللي نقل
        منتجاته لأقسام فرعية كان بيلاقي الأب فاضي في متجره.
      */
      const children = await db
        .select({ id: categories.id })
        .from(categories)
        .where(and(eq(categories.storeId, storeId), eq(categories.parentId, block.categoryId)))

      conditions.push(inArray(products.categoryId, [block.categoryId, ...children.map((c) => c.id)]))
    } else {
      conditions.push(eq(products.categoryId, block.categoryId))
    }
  }

  if (block.source === 'featured') conditions.push(eq(products.isFeatured, true))
  if (block.source === 'sale') {
    conditions.push(and(isNotNull(products.compareAtPrice), gt(products.compareAtPrice, products.price))!)
  }

  const orderBy = block.source === 'best' ? desc(products.soldCount) : desc(products.createdAt)

  return db
    .select(productFields)
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...conditions))
    .orderBy(orderBy)
    .limit(Math.min(Math.max(block.limit, 1), 48))
}

export type HomeData = {
  /** منتجات كل بلوك، بمفتاح `Section.id` */
  productsByBlock: Map<string, StorefrontProduct[]>
  /** فيه أي منتج منشور في المتجر أصلًا؟ */
  hasAnyProduct: boolean
}

/**
 * يقرا البلوكات ويجيب منتجاتها كلها في دفعة واحدة.
 *
 * البلوكات المطفية ما بتتجابش: التاجر اللي مطفّي أربع بلوكات مش
 * مفروض يدفع سرعتها.
 */
export async function loadHomeProducts(
  storeId: string,
  sections: Section[],
  hasAnyProduct: boolean,
): Promise<HomeData> {
  const wanted: Array<{ sectionId: string; key: string; block: ProductsBlock }> = []

  for (const section of sections) {
    if (!section.enabled) continue
    if (renderType(section.type) !== 'products') continue

    const block = readBlock('products', section.settings)
    /*
      النوع القديم بيفرض مصدره: التاجر اللي حافظ «التخفيضات» من زمان
      ما حفظش `source` أصلًا، فلو سبناه على الافتراضي كان هيلاقي
      «الجديد» مكانه من غير ما يعمل حاجة.
    */
    const forced = legacySource(section.type)
    const resolved = forced && !section.settings?.source ? { ...block, source: forced } : block

    wanted.push({ sectionId: section.id, key: queryKey(resolved), block: resolved })
  }

  const uniqueKeys = [...new Set(wanted.map((w) => w.key))]
  const byKey = new Map(uniqueKeys.map((k) => [k, wanted.find((w) => w.key === k)!.block]))

  const results = await Promise.all(
    uniqueKeys.map(async (key) => [key, await runQuery(storeId, byKey.get(key)!)] as const),
  )

  const cache = new Map(results)
  const productsByBlock = new Map<string, StorefrontProduct[]>()
  for (const w of wanted) productsByBlock.set(w.sectionId, cache.get(w.key) ?? [])

  return { productsByBlock, hasAnyProduct }
}
