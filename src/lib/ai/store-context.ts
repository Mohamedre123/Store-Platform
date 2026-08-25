import 'server-only'
import { cache } from 'react'
import { and, asc, desc, eq, inArray, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  categories,
  pages,
  paymentMethods,
  productOptionValues,
  productOptions,
  products,
  shippingRates,
  shippingZones,
  stores,
} from '@/db/schema'
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
  sample: Array<{
    name: string
    price: string
    category: string | null
    stock: string
    /** «المقاس: S، M، L» — العميل بيسأل عنها قبل أي حاجة تانية */
    options: string[]
  }>
  /**
   * التشغيل: شحن، دفع، صفحات السياسات.
   *
   * **من غيره البوت كان بيقول «مش عندي معلومة» عن أهم تلات أسئلة
   * بتتسأل قبل الشرا** — بكام الشحن، بيوصل امتى، وبدفع إزاي. وده
   * بالظبط اللي بيخلّي العميل يقفل الشات ويسأل على واتساب، أو يسيب.
   */
  ops: {
    shipping: string[]
    payments: string[]
    freeShippingOver: string | null
    codEnabled: boolean
    /** عناوين صفحات المتجر ومقتطف منها — الاسترجاع والاستبدال وغيره */
    pages: Array<{ title: string; excerpt: string }>
  }
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
          id: products.id,
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

    /**
     * خيارات المنتجات المعروضة.
     *
     * «عندكم مقاس XL؟» أكتر سؤال بيتسأل في متاجر الهدوم، وكان البوت
     * بيقول «مش متأكد» — مع إن الجواب في قاعدة البيانات. استعلامان
     * على المنتجات المعروضة بس.
     */
    const ids = sample.map((p) => p.id).filter(Boolean)
    const optionRows = ids.length
      ? await db
          .select({
            productId: productOptions.productId,
            option: productOptions.name,
            value: productOptionValues.value,
          })
          .from(productOptions)
          .innerJoin(
            productOptionValues,
            eq(productOptionValues.optionId, productOptions.id),
          )
          .where(inArray(productOptions.productId, ids))
          .orderBy(asc(productOptions.position), asc(productOptionValues.position))
      : []

    const optionsByProduct = new Map<string, Map<string, string[]>>()
    for (const r of optionRows) {
      const byName = optionsByProduct.get(r.productId) ?? new Map<string, string[]>()
      byName.set(r.option, [...(byName.get(r.option) ?? []), r.value])
      optionsByProduct.set(r.productId, byName)
    }

    /*
      الشحن والدفع والسياسات.

      دي التلات حاجات اللي العميل بيسأل عنها قبل ما يشتري: بكام
      الشحن، بيوصل امتى، وبدفع إزاي. البوت اللي مش شايفهم بيرد «مش
      عندي معلومة» على أهم سؤال في المحادثة.
    */
    const [zones, rates, methods, storePages] = await Promise.all([
      db.select().from(shippingZones).where(eq(shippingZones.storeId, storeId)).limit(5),
      db
        .select({ city: shippingRates.city, price: shippingRates.price, min: shippingRates.minDays, max: shippingRates.maxDays })
        .from(shippingRates)
        .where(and(eq(shippingRates.storeId, storeId), eq(shippingRates.enabled, true)))
        .orderBy(asc(shippingRates.sortOrder))
        .limit(40),
      db
        .select({ gateway: paymentMethods.gateway, displayName: paymentMethods.displayName })
        .from(paymentMethods)
        .where(and(eq(paymentMethods.storeId, storeId), eq(paymentMethods.enabled, true)))
        .limit(10),
      db
        .select({ title: pages.title, content: pages.content })
        .from(pages)
        .where(and(eq(pages.storeId, storeId), eq(pages.isPublished, true)))
        .limit(10),
    ])

    const zone = zones[0]
    const shipping: string[] = []

    if (zone) {
      const days = zone.minDays === zone.maxDays ? `${zone.minDays} يوم` : `${zone.minDays}–${zone.maxDays} أيام`
      shipping.push(`الشحن الافتراضي ${formatMoney(zone.defaultPrice, currency)} — التوصيل خلال ${days}`)
    }

    for (const r of rates.slice(0, 30)) {
      const days = r.min && r.max ? ` (${r.min}–${r.max} أيام)` : ''
      shipping.push(`${r.city}: ${formatMoney(r.price, currency)}${days}`)
    }

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
        options: [...(optionsByProduct.get(p.id) ?? new Map())].map(
          ([name, values]) => `${name}: ${(values as string[]).join('، ')}`,
        ),
      })),
      ops: {
        shipping,
        payments: methods.map((m) => m.displayName ?? m.gateway),
        freeShippingOver:
          zone?.freeShippingEnabled && zone.freeOverAmount > 0
            ? formatMoney(zone.freeOverAmount, currency)
            : null,
        codEnabled: zone?.codEnabled ?? true,
        /*
          مقتطف لا الصفحة كاملة: سياسة الاسترجاع ممكن تكون ألف كلمة،
          وحشرها في تعليمات كل رسالة بتغرق باقي التعليمات وبتكلّف
          التاجر توكنز في كل سؤال.
        */
        pages: storePages
          .filter((p) => p.content?.trim())
          .map((p) => ({
            title: p.title,
            excerpt: p.content!.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400),
          })),
      },
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

/**
 * الكتالوج كامل ولا مقصوص؟
 *
 * الفرق ده هو اللي بيخلّي البوت يجاوب بثقة أو يتمتم.
 *
 * القايمة كانت بتتبعتله من غير ما حد يقوله إنها الكل، فكان بيتصرّف
 * على إنها **عيّنة**: العميل يسأل عن منتج مش فيها فيقول «مش متأكد
 * من توفره» — حتى لو المتجر فيه منتج واحد وهو شايفه قدامه. والرد
 * ده بيخلّي العميل يفتكر إن المتجر مش عارف بضاعته هو.
 *
 * لما القايمة تبقى كاملة، «مش موجود في القايمة» بيبقى **حقيقة** لا
 * تخمين — والبوت يقولها كده.
 */
/**
 * الشحن والدفع والسياسات — بتتحط في تعليمات البوت.
 *
 * البوت كان شايف الكتالوج بس، فأول ما العميل يسأل «الشحن بكام؟» أو
 * «بيوصل امتى؟» أو «بدفع إزاي؟» بيرد «مش عندي معلومة دقيقة» — وهي
 * تلات أسئلة بتتسأل قبل الشرا مباشرةً، والرد ده بيوقف البيعة.
 *
 * الكلام كله في قاعدة البيانات أصلًا؛ كان ناقص إننا نوريهوله.
 */
export function operationsBlock(brief: StoreBrief): string {
  const parts: string[] = []

  if (brief.ops.shipping.length) {
    parts.push('الشحن والتوصيل:', ...brief.ops.shipping.map((s) => `- ${s}`))
  }

  if (brief.ops.freeShippingOver) {
    parts.push(`- الشحن مجاني للطلبات فوق ${brief.ops.freeShippingOver}`)
  }

  const pay: string[] = []
  if (brief.ops.codEnabled) pay.push('الدفع عند الاستلام')
  pay.push(...brief.ops.payments)
  if (pay.length) parts.push('', `طرق الدفع المتاحة: ${[...new Set(pay)].join('، ')}`)

  if (brief.ops.pages.length) {
    parts.push('', 'سياسات المتجر:')
    for (const p of brief.ops.pages) parts.push(`- ${p.title}: ${p.excerpt}`)
  }

  return parts.length ? parts.join('\n') : 'مافيش معلومات شحن أو دفع مسجّلة في المتجر.'
}

export function catalogIsComplete(brief: StoreBrief, limit = 40): boolean {
  return (
    brief.productCount > 0 &&
    brief.productCount <= limit &&
    brief.sample.length >= brief.productCount
  )
}

/** كتالوج مختصر — بيتحط في تعليمات البوت عشان يرد بأسعار حقيقية */
export function catalogBlock(brief: StoreBrief, limit = 40): string {
  if (brief.sample.length === 0) return 'المتجر لسه مافيهوش أي منتج معروض.'

  const lines = brief.sample
    .slice(0, limit)
    .map(
      (p) =>
        `- ${p.name}${p.category ? ` [${p.category}]` : ''} — ${p.price} — ${p.stock}` +
        /* المقاسات جنب المنتج مباشرةً: «عندكم XL؟» بيتجاوب من السطر ده */
        (p.options.length ? ` — ${p.options.join(' | ')}` : ''),
    )

  const note = catalogIsComplete(brief, limit)
    ? `(القايمة دي كل منتجات المتجر — عددها ${brief.productCount}. مفيش غيرها خالص.)`
    : `(دي ${lines.length} منتج من إجمالي ${brief.productCount} — فيه منتجات تانية مش مذكورة هنا.)`

  return `${note}\n${lines.join('\n')}`
}
