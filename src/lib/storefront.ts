import 'server-only'
import { cache } from 'react'
import { and, desc, eq, gt, ilike, inArray, isNotNull, isNull, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { banners, categories, pages, products, productVariants, reviews, stores, storePlugins, storeThemes } from '@/db/schema'
import { getTheme, type ThemeDefinition } from './themes'
import {
  defaultCustomization,
  mergeCustomization,
  type Customization,
  type HeroSlide,
  type PanelKey,
} from './customization'
import type { SortKey } from './sort-options'
import type { ActivePixels } from './plugins'
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
  /** أيقونة التبويب — بيرفعها التاجر من الإعدادات */
  favicon: string | null
  hideNameInHeader: boolean
  phone: string | null
  whatsapp: string | null
  email: string | null
  currency: string
  country: string
  isPublished: boolean
  vatEnabled: boolean
  vatRate: number
  vatIncludedInPrice: boolean
  /** الحجوزات مفتوحة؟ منتجات «الخدمة» بتاخد تقويم بدل زرار كمية */
  bookingsEnabled: boolean
  /**
   * نطاق التاجر المخصّص لو ربطه واتحقّقنا منه.
   *
   * كل رابط بيوصل لعميل التاجر (تتبّع الطلب، السلة المتروكة، رابط
   * الإحالة) لازم يتبني عليه. الرابط بالنطاق الفرعي بتاعنا بيوري
   * العميل اسمنا مكان اسم التاجر — وده اللي ربط نطاقه عشان يمنعه.
   */
  customDomain: string | null
  customDomainVerifiedAt: Date | null
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
      favicon: stores.favicon,
      hideNameInHeader: stores.hideNameInHeader,
      phone: stores.phone,
      whatsapp: stores.whatsapp,
      email: stores.email,
      currency: stores.currency,
      country: stores.country,
      isPublished: stores.isPublished,
      vatEnabled: stores.vatEnabled,
      vatRate: stores.vatRate,
      bookingsEnabled: stores.bookingsEnabled,
      vatIncludedInPrice: stores.vatIncludedInPrice,
      customDomain: stores.customDomain,
      customDomainVerifiedAt: stores.customDomainVerifiedAt,
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

/**
 * البانر الرئيسي كما هو مخزَّن في المسوّدة.
 *
 * الشريحة هي `HeroSlide` نفسها — الوصف كان متكرّرًا هنا، وأي حقل
 * جديد كان لازم يتكتب في المكانين وإلا الواجهة ما تشوفهوش. النسخة
 * الواحدة بتمنع الفرق ده من الأساس.
 */
export type HeroDraft = {
  style?: 'fullbleed' | 'boxed' | 'split' | 'stacked' | 'none'
  height?: 'sm' | 'md' | 'lg' | 'full'
  autoplay?: boolean
  intervalSeconds?: number
  slides?: HeroSlide[]
}

export type StoreTheme = {
  definition: ThemeDefinition
  /** التخصيص الكامل المدموج — المصدر الوحيد لشكل المتجر */
  custom: Customization
  tokens: ThemeTokens
  sections: Section[]
  header: Record<string, unknown>
  footer: Record<string, unknown>
  announcementBar: Record<string, unknown>
  hero?: HeroDraft
}

/**
 * شكل المتجر الكامل.
 *
 * المصدر الوحيد للحقيقة هو كائن `Customization` واحد مدموج فوق افتراضي
 * الثيم. كل الصفحات بتقرا منه — فأي إعداد التاجر يغيّره بيتطبّق فعلًا،
 * وده كان أصل مشكلة «بعدّل ومفيش بيتغيّر».
 *
 * في وضع المعاينة بنقرأ المسوّدة الكاملة (draft) بدل النسخة المنشورة،
 * فالتاجر يشوف تعديله قبل ما يضغط نشر. غير كده بنقرأ الأعمدة المنشورة.
 */
export const getStoreTheme = cache(
  async (storeId: string, preview = false): Promise<StoreTheme> => {
    const [row] = await db.select().from(storeThemes).where(eq(storeThemes.storeId, storeId)).limit(1)

    const definition = getTheme(row?.themeSlug ?? 'zawya')
    const base = defaultCustomization(definition)

    const draft = (row?.draft ?? {}) as Record<string, unknown>
    // المسوّدة الكاملة اتحفظت لو فيها لوحة الهوية — الشكل القديم كان
    // بيخزّن hero/toolbar بس، فبنميّز بينهم بوجود identity.
    const draftIsFull = draft && typeof draft.identity === 'object'

    const custom: Customization =
      preview && draftIsFull
        ? mergeCustomization(base, draft as Partial<Record<PanelKey, unknown>>)
        : mergeCustomization(base, {
            identity: row?.tokens,
            announcement: row?.announcementBar,
            header: row?.header,
            footer: row?.footer,
            listing: row?.listingPage,
            productPage: row?.productPage,
            cart: row?.cart,
            hero: draft.hero,
            toolbar: draft.toolbar,
            preloader: draft.preloader,
            effects: draft.effects,
          })

    return {
      definition,
      custom,
      tokens: {
        primary: custom.identity.primary,
        accent: custom.identity.accent,
        background: custom.identity.background,
        surface: custom.identity.surface,
        text: custom.identity.text,
        radius: custom.identity.radius,
        fontHeading: custom.identity.fontHeading,
        fontBody: custom.identity.fontBody,
        iconSet: custom.identity.iconSet,
      } as ThemeTokens,
      sections: (row?.homeSections ?? []) as Section[],
      header: custom.header as unknown as Record<string, unknown>,
      footer: custom.footer as unknown as Record<string, unknown>,
      announcementBar: custom.announcement as unknown as Record<string, unknown>,
      hero: custom.hero as HeroDraft,
    }
  },
)

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
    options: {
      limit?: number
      /** قسم واحد، أو قسم وكل أولاده لو `includeChildren` */
      categoryId?: string
      includeChildren?: boolean
      onSale?: boolean
      featured?: boolean
      sort?: SortKey
    } = {},
  ): Promise<StorefrontProduct[]> => {
    const { limit = 12, categoryId, includeChildren, onSale, featured, sort = 'newest' } = options

    const conditions = [visible(storeId)]
    if (categoryId) {
      /*
        القسم الأب بيعرض منتجاته **ومنتجات أولاده**.

        من غير كده التاجر اللي نقل منتجاته لأقسام فرعية بيلاقي القسم
        الرئيسي فاضي في متجره — وهو أكتر قسم بيتضغط عليه.
      */
      if (includeChildren) {
        const children = await db
          .select({ id: categories.id })
          .from(categories)
          .where(and(eq(categories.storeId, storeId), eq(categories.parentId, categoryId)))

        const ids = [categoryId, ...children.map((c) => c.id)]
        conditions.push(inArray(products.categoryId, ids))
      } else {
        conditions.push(eq(products.categoryId, categoryId))
      }
    }
    if (onSale) conditions.push(and(isNotNull(products.compareAtPrice), gt(products.compareAtPrice, products.price))!)
    if (featured) conditions.push(eq(products.isFeatured, true))

    // الترتيب بيتم في قاعدة البيانات مش في الذاكرة — عشان يفضل صحيحًا
    // مع الـlimit، ولا نجيب صفوفًا زيادة عشان نرتّبها ونرميها
    const orderBy =
      sort === 'price_asc'
        ? products.price
        : sort === 'price_desc'
          ? desc(products.price)
          : sort === 'best_selling'
            ? desc(products.soldCount)
            : desc(products.createdAt)

    return db
      .select(productFields)
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(and(...conditions))
      .orderBy(orderBy)
      .limit(limit)
  },
)

/** منتج مقترح في السلة — الحد الأدنى اللي الإضافة بضغطة محتاجاه */
export type UpsellProduct = {
  id: string
  name: string
  slug: string
  price: number
  image: string | null
  maxStock: number | null
}

/**
 * مقترحات السلة — «أكمل طلبك».
 *
 * الأكثر مبيعًا في المتجر: العميل واقف على خطوة الدفع مش في مزاج تصفّح،
 * والمنتج اللي غيره اشتراه أقرب حاجة يضيفها بضغطة.
 *
 * بنستبعد اللي ليه متغيّرات: الإضافة بضغطة واحدة معناها إننا نختار
 * المقاس نيابةً عن العميل، وده بيرجّع مرتجعًا مش بيعة. واللي نفدت
 * كميته مستبعد كمان — اقتراح منتج مش متاح بيضيّع الثقة في الباقي.
 */
export const listCartUpsell = cache(async (storeId: string, limit = 6): Promise<UpsellProduct[]> => {
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      price: products.price,
      images: products.images,
      stock: products.stock,
      trackInventory: products.trackInventory,
    })
    .from(products)
    .where(
      and(
        visible(storeId),
        sql`not exists (select 1 from ${productVariants} where ${productVariants.productId} = ${products.id})`,
        or(eq(products.trackInventory, false), gt(products.stock, 0))!,
      ),
    )
    .orderBy(desc(products.soldCount))
    .limit(limit)

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    price: r.price,
    image: r.images?.[0] ?? null,
    maxStock: r.trackInventory ? r.stock : null,
  }))
})

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
      parentId: categories.parentId,
      showInMenu: categories.showInMenu,
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

/**
 * كلاس شبكة العرض من إعداد التاجر — مصدر واحد تستخدمه كل صفحات القوائم
 * عشان تفضل متطابقة، والأعمدة تتغيّر فعلًا لما يعدّلها في المحرّر.
 */
export function listingGrid(listing: { columnsDesktop: number; columnsMobile: number }): string {
  const mobile = listing.columnsMobile === 1 ? 'grid-cols-1' : 'grid-cols-2'
  const desk =
    listing.columnsDesktop === 2
      ? 'md:grid-cols-2'
      : listing.columnsDesktop === 3
        ? 'md:grid-cols-3'
        : listing.columnsDesktop === 5
          ? 'md:grid-cols-5'
          : 'md:grid-cols-4'
  return `grid gap-4 sm:gap-5 ${mobile} ${desk}`
}

/**
 * معرّفات البكسل المفعّلة للمتجر.
 *
 * استعلام واحد بيرجّع كل الإضافات المفعّلة، وبنحوّلها لشكل مسطّح
 * يسهل حقنه. مغلّف بـcache زي باقي دوال المتجر.
 */
export const getStorePixels = cache(async (storeId: string): Promise<ActivePixels> => {
  const rows = await db
    .select({ slug: storePlugins.pluginSlug, config: storePlugins.config })
    .from(storePlugins)
    .where(and(eq(storePlugins.storeId, storeId), eq(storePlugins.enabled, true)))

  const get = (slug: string, key: string) => {
    const row = rows.find((r) => r.slug === slug)
    const value = row?.config?.[key]
    return typeof value === 'string' && value ? value : undefined
  }

  return {
    facebookPixelId: get('facebook_pixel', 'pixelId'),
    tiktokPixelId: get('tiktok_pixel', 'pixelId'),
    snapchatPixelId: get('snapchat_pixel', 'pixelId'),
    gaMeasurementId: get('google_analytics', 'measurementId'),
    googleAdsId: get('google_ads', 'conversionId'),
  }
})

/** صفحات السياسات المنشورة اللي تظهر في الفوتر */
export const listFooterPages = cache(async (storeId: string) => {
  return db
    .select({ slug: pages.slug, title: pages.title })
    .from(pages)
    .where(
      and(
        eq(pages.storeId, storeId),
        eq(pages.isPublished, true),
        eq(pages.showInFooter, true),
        isNotNull(pages.content),
      ),
    )
    .orderBy(pages.sortOrder)
})

/** المراجعات المعتمدة لمنتج */
export const listProductReviews = cache(async (productId: string) => {
  return db
    .select({
      id: reviews.id,
      authorName: reviews.authorName,
      rating: reviews.rating,
      body: reviews.body,
      isVerifiedPurchase: reviews.isVerifiedPurchase,
      merchantReply: reviews.merchantReply,
      createdAt: reviews.createdAt,
    })
    .from(reviews)
    .where(and(eq(reviews.productId, productId), eq(reviews.isApproved, true)))
    .orderBy(desc(reviews.createdAt))
    .limit(50)
})

/**
 * البحث في منتجات المتجر.
 *
 * بحث نصي بسيط على الاسم والوصف المختصر — كفاية لمتجر بمئات المنتجات.
 * `ilike` بيتجاهل حالة الحروف، والعربي مالوش حالة أصلًا فالنتيجة صح.
 */
export const searchProducts = cache(
  async (storeId: string, query: string, limit = 40): Promise<StorefrontProduct[]> => {
    const q = query.trim()
    if (q.length < 2) return []

    const pattern = `%${q}%`
    return db
      .select(productFields)
      .from(products)
      .leftJoin(categories, eq(categories.id, products.categoryId))
      .where(
        and(
          visible(storeId),
          or(ilike(products.name, pattern), ilike(products.shortDescription, pattern)),
        ),
      )
      .orderBy(desc(products.soldCount))
      .limit(limit)
  },
)

/**
 * البانرات الشغّالة في مكان معيّن.
 *
 * الفلترة بالتاريخ في قاعدة البيانات مش في الكود: البانر بينتهي لوحده
 * في اللحظة المحددة من غير ما حد يفتكر يقفله.
 */
export const getActiveBanners = cache(
  async (storeId: string, placement: 'hero' | 'promo' | 'category' | 'popup') => {
    return db
      .select({
        id: banners.id,
        title: banners.title,
        subtitle: banners.subtitle,
        imageDesktop: banners.imageDesktop,
        imageMobile: banners.imageMobile,
        ctaLabel: banners.ctaLabel,
        ctaUrl: banners.ctaUrl,
      })
      .from(banners)
      .where(
        and(
          eq(banners.storeId, storeId),
          eq(banners.placement, placement),
          eq(banners.isActive, true),
          or(isNull(banners.startsAt), sql`${banners.startsAt} <= now()`)!,
          or(isNull(banners.endsAt), sql`${banners.endsAt} >= now()`)!,
        ),
      )
      .orderBy(banners.sortOrder)
      .limit(5)
  },
)
