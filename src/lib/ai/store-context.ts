import 'server-only'
import { cache } from 'react'
import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { categories, products, stores } from '@/db/schema'
import { formatMoney } from '@/lib/utils'

/**
 * سياق المتجر للذكاء الاصطناعي.
 *
 * الفرق بين تحسين مفيد وكلام عام هو ده بالظبط. «تيشيرت قطن» من غير
 * سياق بيرجع «تيشيرت قطن مميز وعالي الجودة» — كلام مالوش قيمة في
 * السيو. مع السياق (متجر ملابس رجالي، قسم تيشيرتات، سعر ٤٩٠) بيرجع
 * كلمات بحث حقيقية الناس بتدوّر بيها.
 *
 * ونفس السياق هو اللي بيخلّي بوت المتجر يبان «كأنه اتدرّب» — هو مش
 * متدرّب، إحنا بنحطّ له الكتالوج قدامه مع كل سؤال.
 */

export type StoreBrief = {
  name: string
  tagline: string | null
  /** وصف التاجر لمتجره — أدق حاجة لو كتبها */
  merchantBrief: string | null
  currency: string
  categories: string[]
  productCount: number
  priceRange: { min: number; max: number } | null
  /** عيّنة منتجات بأسعارها — أساس رد البوت على «عندكم إيه؟» */
  sample: Array<{ name: string; price: string; category: string | null; stock: string }>
}

/**
 * بيانات المتجر المشتركة.
 *
 * مغلّفة بـcache: صفحة واحدة ممكن تنادي التحسين أكتر من مرة، ومن غير
 * التغليف كل ضغطة زرار بتعمل ٣ استعلامات على نفس البيانات.
 */
export const getStoreBrief = cache(
  async (storeId: string, merchantBrief?: string | null): Promise<StoreBrief> => {
    const [[store], cats, [stats], sample] = await Promise.all([
      db
        .select({ name: stores.name, tagline: stores.tagline, currency: stores.currency })
        .from(stores)
        .where(eq(stores.id, storeId))
        .limit(1),

      db
        .select({ name: categories.name })
        .from(categories)
        .where(eq(categories.storeId, storeId))
        .orderBy(asc(categories.sortOrder))
        .limit(30),

      db
        .select({
          n: sql<number>`count(*)::int`,
          min: sql<number>`coalesce(min(${products.price}), 0)::int`,
          max: sql<number>`coalesce(max(${products.price}), 0)::int`,
        })
        .from(products)
        .where(
          and(
            eq(products.storeId, storeId),
            eq(products.status, 'active'),
            isNull(products.deletedAt),
          ),
        ),

      /*
        الأكثر مبيعًا لا الأحدث: دول اللي العميل بيسأل عنهم، ودول اللي
        بيوصفوا المتجر لو التاجر ما كتبش وصفًا.
      */
      db
        .select({
          name: products.name,
          price: products.price,
          stock: products.stock,
          trackInventory: products.trackInventory,
          categoryName: categories.name,
        })
        .from(products)
        .leftJoin(categories, eq(categories.id, products.categoryId))
        .where(
          and(
            eq(products.storeId, storeId),
            eq(products.status, 'active'),
            isNull(products.deletedAt),
          ),
        )
        .orderBy(desc(products.soldCount), desc(products.createdAt))
        .limit(40),
    ])

    const currency = store?.currency ?? 'EGP'

    return {
      name: store?.name ?? 'المتجر',
      tagline: store?.tagline ?? null,
      merchantBrief: merchantBrief?.trim() || null,
      currency,
      categories: cats.map((c) => c.name),
      productCount: Number(stats?.n ?? 0),
      priceRange:
        Number(stats?.n ?? 0) > 0
          ? { min: Number(stats.min), max: Number(stats.max) }
          : null,
      sample: sample.map((p) => ({
        name: p.name,
        price: formatMoney(p.price, currency),
        category: p.categoryName,
        stock: !p.trackInventory ? 'متاح' : p.stock > 0 ? `متاح (${p.stock})` : 'نفدت الكمية',
      })),
    }
  },
)

/**
 * وصف مختصر للمتجر يتحطّ في تعليمات النظام.
 *
 * وصف التاجر بيتحطّ أول حاجة لو موجود — هو أدق من أي استنتاج. ولو
 * مش موجود، الأقسام والمنتجات بيوصفوا المتجر كفاية.
 */
export function briefLine(brief: StoreBrief): string {
  if (brief.merchantBrief) return brief.merchantBrief

  const parts: string[] = []
  if (brief.tagline) parts.push(brief.tagline)
  if (brief.categories.length) parts.push(`بيبيع: ${brief.categories.slice(0, 8).join('، ')}`)
  if (brief.priceRange && brief.priceRange.min > 0) {
    parts.push(
      `الأسعار من ${formatMoney(brief.priceRange.min, brief.currency)} لـ${formatMoney(brief.priceRange.max, brief.currency)}`,
    )
  }
  return parts.join('. ') || 'متجر إلكتروني.'
}

/** اقتراح تلقائي لوصف المتجر — بيتحط في خانة التاجر عشان يعدّله */
export function suggestBrief(brief: StoreBrief): string {
  const cats = brief.categories.slice(0, 6)
  const head = brief.tagline ? `${brief.name} — ${brief.tagline}.` : `${brief.name}.`
  const body = cats.length
    ? ` بيبيع ${cats.join('، ')}.`
    : brief.sample.length
      ? ` بيبيع ${brief.sample.slice(0, 4).map((p) => p.name).join('، ')}.`
      : ''
  const price =
    brief.priceRange && brief.priceRange.min > 0
      ? ` الأسعار من ${formatMoney(brief.priceRange.min, brief.currency)} لـ${formatMoney(brief.priceRange.max, brief.currency)}.`
      : ''
  return (head + body + price).trim()
}

/** كتالوج مختصر — بيتحط في تعليمات البوت عشان يرد بأسعار حقيقية */
export function catalogBlock(brief: StoreBrief, limit = 40): string {
  if (brief.sample.length === 0) return 'المتجر لسه مافيهوش منتجات.'

  const lines = brief.sample
    .slice(0, limit)
    .map((p) => `- ${p.name}${p.category ? ` [${p.category}]` : ''} — ${p.price} — ${p.stock}`)

  const more =
    brief.productCount > lines.length
      ? `\n(وفيه ${brief.productCount - lines.length} منتج تاني مش مذكورين هنا)`
      : ''

  return lines.join('\n') + more
}
