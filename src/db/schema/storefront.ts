import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { stores } from './tenancy'
import { createdAt, updatedAt } from './_shared'

/** توكنات الهوية البصرية للمتجر */
export type ThemeTokens = {
  primary: string
  primaryDark?: string
  accent?: string
  background?: string
  surface?: string
  text?: string
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'full'
  fontHeading?: string
  fontBody?: string
  iconSet?: 'lucide' | 'tabler' | 'phosphor' | 'heroicons' | 'remix'
  mode?: 'light' | 'dark' | 'auto'
}

/** قسم في صفحة — قابل للترتيب والإخفاء */
export type Section = {
  id: string
  type: string
  enabled: boolean
  settings: Record<string, unknown>
}

/**
 * إعدادات ثيم المتجر. الثيم نفسه (التخطيط والمكوّنات) مُعرَّف في الكود؛
 * هنا نخزّن اختيار المتجر وتعديلاته فقط.
 */
export const storeThemes = pgTable('store_themes', {
  storeId: uuid('store_id')
    .primaryKey()
    .references(() => stores.id, { onDelete: 'cascade' }),
  themeSlug: text('theme_slug').notNull().default('zawya'),
  tokens: jsonb('tokens').$type<ThemeTokens>().notNull().default({ primary: '#4C3A78' }),
  homeSections: jsonb('home_sections').$type<Section[]>().notNull().default([]),
  header: jsonb('header').$type<Record<string, unknown>>().notNull().default({}),
  footer: jsonb('footer').$type<Record<string, unknown>>().notNull().default({}),
  productPage: jsonb('product_page').$type<Record<string, unknown>>().notNull().default({}),
  listingPage: jsonb('listing_page').$type<Record<string, unknown>>().notNull().default({}),
  cart: jsonb('cart').$type<Record<string, unknown>>().notNull().default({}),
  announcementBar: jsonb('announcement_bar').$type<Record<string, unknown>>().notNull().default({}),
  customCss: text('custom_css'),
  /** مسوّدة غير منشورة — التاجر يعاين قبل ما يطبّق */
  draft: jsonb('draft').$type<Record<string, unknown>>(),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  updatedAt: updatedAt(),
})

/** صفحة الشكر — 11 مكوّنًا قابلًا للتشغيل */
export const thankYouSettings = pgTable('thank_you_settings', {
  storeId: uuid('store_id')
    .primaryKey()
    .references(() => stores.id, { onDelete: 'cascade' }),
  showOrderSummary: boolean('show_order_summary').notNull().default(true),
  showProgressTracker: boolean('show_progress_tracker').notNull().default(true),
  showWhatsappButton: boolean('show_whatsapp_button').notNull().default(true),
  showTelegramButton: boolean('show_telegram_button').notNull().default(false),
  showLoyaltyPoints: boolean('show_loyalty_points').notNull().default(true),
  showTimeline: boolean('show_timeline').notNull().default(true),
  allowCancel: boolean('allow_cancel').notNull().default(true),
  showPaymentReceipt: boolean('show_payment_receipt').notNull().default(true),
  showShareOrder: boolean('show_share_order').notNull().default(true),
  showNextPurchaseIncentive: boolean('show_next_purchase_incentive').notNull().default(false),
  allowDownloadReceipt: boolean('allow_download_receipt').notNull().default(true),
  nextDiscountBps: integer('next_discount_bps').notNull().default(1000),
  recommendedCount: integer('recommended_count').notNull().default(4),
  customCouponCode: text('custom_coupon_code'),
  customMessage: text('custom_message'),
  updatedAt: updatedAt(),
})

/** صفحات ثابتة وسياسات */
export const pages = pgTable(
  'pages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    content: text('content'),
    type: text('type').$type<'page' | 'terms' | 'privacy' | 'refund' | 'shipping_policy' | 'about' | 'faq'>().notNull().default('page'),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    showInFooter: boolean('show_in_footer').notNull().default(true),
    isPublished: boolean('is_published').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('pages_store_slug_unique').on(t.storeId, t.slug)],
)

/** صفحات البيع (الفانلز) — لاندنج للمنتج الواحد */
export const funnels = pgTable(
  'funnels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    productId: uuid('product_id'),
    template: text('template').notNull().default('classic'),
    blocks: jsonb('blocks').$type<Array<{ id: string; type: string; settings: Record<string, unknown> }>>().notNull().default([]),
    tokens: jsonb('tokens').$type<Record<string, unknown>>().notNull().default({}),
    // عناصر رفع التحويل
    hasCountdown: boolean('has_countdown').notNull().default(false),
    countdownMinutes: integer('countdown_minutes').notNull().default(15),
    hasUpsell: boolean('has_upsell').notNull().default(false),
    upsellProductIds: jsonb('upsell_product_ids').$type<string[]>().notNull().default([]),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    status: text('status').$type<'draft' | 'published' | 'archived'>().notNull().default('draft'),
    views: integer('views').notNull().default(0),
    conversions: integer('conversions').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('funnels_store_slug_unique').on(t.storeId, t.slug),
    index('funnels_store_idx').on(t.storeId, t.status),
  ],
)

export const blogPosts = pgTable(
  'blog_posts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    excerpt: text('excerpt'),
    content: text('content'),
    cover: text('cover'),
    author: text('author'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    isPublished: boolean('is_published').notNull().default(false),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    views: integer('views').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('blog_posts_store_slug_unique').on(t.storeId, t.slug)],
)

/** بانرات وشرائح الصفحة الرئيسية */
export const banners = pgTable(
  'banners',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    placement: text('placement').$type<'hero' | 'promo' | 'category' | 'popup'>().notNull().default('hero'),
    title: text('title'),
    subtitle: text('subtitle'),
    imageDesktop: text('image_desktop'),
    imageMobile: text('image_mobile'),
    ctaLabel: text('cta_label'),
    ctaUrl: text('cta_url'),
    textPosition: text('text_position').$type<'start' | 'center' | 'end'>().notNull().default('start'),
    startsAt: timestamp('starts_at', { withTimezone: true }),
    endsAt: timestamp('ends_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('banners_store_placement_idx').on(t.storeId, t.placement, t.isActive)],
)
