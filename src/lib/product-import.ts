import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { categories, products } from '@/db/schema'
import { slugify } from './utils'
import type { ImportRow } from './product-csv'

/**
 * كتابة المنتجات المستوردة في الكتالوج.
 *
 * ## ليه مفصول عن `product-csv`
 * ده بيلمس قاعدة البيانات، والتاني بيتنادى **من المتصفح**: معالج
 * الاستيراد بيقرا الملف ويعرض المعاينة من غير أي رحلة للخادم، عشان
 * التاجر يغيّر ربط عمود ويشوف النتيجة في نفس اللحظة. القراءة لازم
 * تكون كودًا يشتغل في المتصفح، والكتابة لازم تفضل على الخادم وحده.
 *
 * نفس نمط `blocklist` و`blocklist-meta`.
 */

export type ImportResult = { created: number; skipped: number; categories: number }

/**
 * كتابة المنتجات.
 *
 * ## الموجود بيتخطّى ولا بيتدهس
 * التاجر بيرفع نفس الملف مرتين (اتلخبط، أو زوّد صفوف). الكتابة فوق
 * الموجود كانت هترجّع الأسعار اللي عدّلها في اللوحة لأسعار الملف
 * القديم — وده بيتكشف بعد ما عملاء يشتروا بالسعر الغلط.
 *
 * التخطّي بالرابط (`slug`) لأنه المفتاح الفريد اللي المتجر بيشتغل
 * بيه، والاسم هو اللي بيولّده.
 *
 * ## والأقسام بتتعمل لوحدها
 * الملف فيه أسماء أقسام نصًا. لو سبناها، كل المنتجات بتنزل بلا قسم
 * والتاجر بيقعد يوزّعهم بإيده — وده نص شغل الإدخال اليدوي اللي
 * الاستيراد المفروض يوفّره.
 */
export async function importProducts(
  storeId: string,
  items: ImportRow[],
): Promise<ImportResult> {
  if (items.length === 0) return { created: 0, skipped: 0, categories: 0 }

  /* الأقسام المطلوبة، والموجود منها بالفعل */
  const wanted = [...new Set(items.map((i) => i.category).filter(Boolean))] as string[]
  const categoryIds = new Map<string, string>()
  let newCategories = 0

  if (wanted.length) {
    const existing = await db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.storeId, storeId), inArray(categories.name, wanted)))

    for (const c of existing) categoryIds.set(c.name, c.id)

    const missing = wanted.filter((n) => !categoryIds.has(n))
    for (const name of missing) {
      const [created] = await db
        .insert(categories)
        .values({ storeId, name, slug: slugify(name) || `cat-${Date.now()}` })
        .onConflictDoNothing()
        .returning({ id: categories.id })

      if (created) {
        categoryIds.set(name, created.id)
        newCategories += 1
      }
    }
  }

  /* الروابط الموجودة — استعلام واحد بدل واحد لكل منتج */
  const slugs = items.map((i) => slugify(i.name) || 'product')
  const taken = new Set(
    (
      await db
        .select({ slug: products.slug })
        .from(products)
        .where(and(eq(products.storeId, storeId), inArray(products.slug, slugs)))
    ).map((r) => r.slug),
  )

  const toInsert: Array<typeof products.$inferInsert> = []
  let skipped = 0
  const used = new Set<string>()

  items.forEach((item, i) => {
    const slug = slugs[i]
    /* الموجود في القاعدة، أو المتكرر جوّه نفس الملف */
    if (taken.has(slug) || used.has(slug)) {
      skipped += 1
      return
    }
    used.add(slug)

    toInsert.push({
      storeId,
      name: item.name,
      slug,
      description: item.description,
      price: item.price,
      compareAtPrice: item.compareAtPrice,
      costPrice: item.costPrice,
      sku: item.sku,
      stock: item.stock,
      brand: item.brand,
      categoryId: item.category ? (categoryIds.get(item.category) ?? null) : null,
      images: item.image ? [item.image] : [],
      /*
        بيدخلوا **مسوّدات** لا نشطين.

        تلتمية منتج بينزلوا المتجر فجأة من غير ما التاجر يراجع صورة
        ولا سعر واحد — والعميل بيشوف كتالوجًا نُصّه صور مكسورة.
        التاجر بينشرهم لما يجهّزهم.
      */
      status: 'draft',
    })
  })

  /* الإدراج على دفعات — ألف صف في جملة واحدة بيضرب حد حجم الطلب */
  const CHUNK = 100
  for (let i = 0; i < toInsert.length; i += CHUNK) {
    await db.insert(products).values(toInsert.slice(i, i + CHUNK)).onConflictDoNothing()
  }

  return { created: toInsert.length, skipped, categories: newCategories }
}
