import 'server-only'
import { cache } from 'react'
import { and, desc, eq, gt, isNotNull, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { categories, products, stores, storeThemes } from '@/db/schema'
import { getTheme, type ThemeDefinition } from './themes'
import type { Section, ThemeTokens } from '@/db/schema'

/**
 * قراءة بيانات المتجر لواجهة العميل.
 *
 * كل الدوال هنا مغلّفة بـcache: الصفحة الواحدة بتستدعي بيانات المتجر
 * في التخطيط والهيدر والمحتوى، ومن غير التغليف ده كان هيبقى ٣ استعلامات
 * لنفس الصف في الطلب الواحد.
 *
 * المتجر غير المنشور ما بيتعرضش — إلا لو التاجر نفسه بيعاين.
 */

export type StorefrontStore = {
  id: string
  slug: string
  name: string
  nameEn: string | null
  tagline: string | null
  logoLight: string | null
  logoDark: string | null
  hideNameInHeader: boolean
  phone: string | null
  whatsapp: string | null
  currency: string
  country: string
  isPublished: boolean
  vatEnabled: boolean
  vatRate: number
  vatIncludedInPrice: boolean
}

/** يحلّ المتجر من النطاق الفرعي أو النطاق المخصّص */
export const getStore = cache(async (identifier: string): Promise<StorefrontStore | null> => {
  const rows = await db
    .select({
      id: stores.id,
      slug: stores.slug,
      name: stores.name,
      nameEn: stores.nameEn,
      tagline: stores.tagline,
      logoLight: stores.logoLight,
      logoDark: stores.logoDark,
      hideNameInHeader: stores.hideNameInHeader,
      phone: stores.phone,
      whatsapp: stores.whatsapp,
      currency: stores.currency,
      country: stores.country,
      isPublished: stores.isPublished,
      vatEnabled: stores.vatEnabled,
      vatRate: stores.vatRate,
      vatIncludedInPrice: stores.vatIncludedInPrice,
      deletedAt: stores.deletedAt,
    })
    .from(stores)
    .where(
      or(
        eq(stores.slug, identifier),
        and(eq(stores.customDomain, identifier), isNotNull(stores.customDomainVerifiedAt)),
      ),
    )
    .limit(1)

  const store = rows[0]
  if (!store || store.deletedAt) return null

  const { deletedAt: _ignored, ...rest } = store
  return rest
})

export type HeroDraft = {
  style?: 'fullbleed' | 'boxed' | 'split' | 'stacked' | 'none'
  height?: 'sm' | 'md' | 'lg' | 'full'
  autoplay?: boolean
  intervalSeconds?: number
  slides?: Array<{
    id: string
    imageDesktop: string | null
    imageMobile: string | null
    title: string
    subtitle: string
    ctaLabel: string
    ctaUrl: string
    textPosition: 'start' | 'center' | 'end'
    overlay: number
  }>
}

export type StoreTheme = {
  definition: ThemeDefinition
  tokens: ThemeTokens
  sections: Section[]
  header: Record<string, unknown>
  footer: Record<string, unknown>
  announcementBar: Record<string, unknown>
  hero?: HeroDraft
}

export const getStoreTheme = cache(async (storeId: string): Promise<StoreTheme> => {
  const [row] = await db.select().from(storeThemes).where(eq(storeThemes.storeId, storeId)).limit(1)

  const definition = getTheme(row?.themeSlug ?? 'zawya')

  return {
    definition,
    // ألوان الثيم أساس، وتعديلات التاجر تعلوها.
    // القيم الفاضية تُتجاهَل عشان لا تمسح لون الثيم بقيمة undefined.
    tokens: {
      primary: definition.palette.primary,
      accent: definition.palette.accent,
      background: definition.palette.background,
      surface: definition.palette.surface,
      text: definition.palette.text,
      radius: definition.radius,
      ...Object.fromEntries(
        Object.entries(row?.tokens ?? {}).filter(([, v]) => v !== undefined && v !== null && v !== ''),
      ),
    } as ThemeTokens,
    sections: (row?.homeSections ?? []) as Section[],
    header: row?.header ?? {},
    footer: row?.footer ?? {},
    announcementBar: row?.announcementBar ?? {},
    // شرائح البانر وشريط الأدوات مخزّنة في draft — نخرجها هنا مرة واحدة
    hero: ((row?.draft ?? {}) as Record<string, unknown>).hero as HeroDraft | undefined,
  }
})

/* ────────────────────────── الكتالوج ────────────────────────── */

export type StorefrontProduct = {
  id: string
  name: string
  slug: string
  shortDescription: string | null
  price: number
  compareAtPrice: number | null
  images: string[]
  stock: number
  trackInventory: boolean
  ratingSum: number
  ratingCount: number
  showStockCounter: boolean
  categoryName: string | null
}

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

/** المنتجات المعروضة — النشطة فقط، وغير المحذوفة */
const visible = (storeId: string) =>
  and(eq(products.storeId, storeId), eq(products.status, 'active'), sql`${products.deletedAt} is null`)

export const listProducts = cache(
  async (
    storeId: string,
    options: { limit?: number; categoryId?: string; onSale?: boolean; featured?: boolean } = {},
  ): Promise<StorefrontProduct[]> => {
    const { limit = 12, categoryId, onSale, featured } = options

    const conditions = [visible(storeId)]
    if (categoryId) conditions.push(eq(products.categoryId, categoryId))
    if (onSale) conditions.push(and(isNotNull(products.compareAtPrice), gt(products.compareAtPrice, products.price))!)
    if (featured) conditions.push(eq(products.isFeatured, true))

    return db
      .select(productFields)
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(...conditions))
      .orderBy(desc(products.createdAt))
      .limit(limit)
  },
)

export const getProductBySlug = cache(async (storeId: string, slug: string) => {
  const [row] = await db
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.slug, slug), eq(products.status, 'active')))
    .limit(1)

  return row ?? null
})

export const listCategories = cache(async (storeId: string) => {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      slug: categories.slug,
      image: categories.image,
      productCount: sql<number>`count(${products.id})::int`,
    })
    .from(categories)
    .leftJoin(products, and(eq(products.categoryId, categories.id), eq(products.status, 'active')))
    .where(and(eq(categories.storeId, storeId), eq(categories.isActive, true)))
    .groupBy(categories.id)
    .orderBy(categories.sortOrder)
})

export const getCategoryBySlug = cache(async (storeId: string, slug: string) => {
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.storeId, storeId), eq(categories.slug, slug), eq(categories.isActive, true)))
    .limit(1)

  return row ?? null
})

/** نسبة الخصم للعرض على الشارة */
export function discountPercent(price: number, compareAt: number | null): number | null {
  if (!compareAt || compareAt <= price) return null
  return Math.round(((compareAt - price) / compareAt) * 100)
}
