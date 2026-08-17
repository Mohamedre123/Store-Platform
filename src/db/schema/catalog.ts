import { pgTable, uuid, text, boolean, integer, jsonb, index, uniqueIndex, timestamp } from 'drizzle-orm/pg-core'
import { stores } from './tenancy'
import { createdAt, updatedAt, deletedAt, money, moneyNullable } from './_shared'

export type ProductType = 'physical' | 'digital' | 'service'
export type ProductStatus = 'draft' | 'active' | 'archived'

export const categories = pgTable(
  'categories',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    parentId: uuid('parent_id'),
    name: text('name').notNull(),
    nameEn: text('name_en'),
    slug: text('slug').notNull(),
    description: text('description'),
    image: text('image'),
    icon: text('icon'),
    sortOrder: integer('sort_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    showInMenu: boolean('show_in_menu').notNull().default(true),
    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('categories_store_slug_unique').on(t.storeId, t.slug),
    index('categories_store_idx').on(t.storeId),
    index('categories_parent_idx').on(t.parentId),
  ],
)

export const products = pgTable(
  'products',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),

    name: text('name').notNull(),
    nameEn: text('name_en'),
    slug: text('slug').notNull(),
    shortDescription: text('short_description'),
    description: text('description'),
    descriptionEn: text('description_en'),

    type: text('type').$type<ProductType>().notNull().default('physical'),
    status: text('status').$type<ProductStatus>().notNull().default('draft'),

    // التسعير — بالوحدة الصغرى للعملة
    price: money('price'),
    compareAtPrice: moneyNullable('compare_at_price'), // السعر قبل الخصم
    costPrice: moneyNullable('cost_price'), // التكلفة — أساس حساب الربح الحقيقي

    sku: text('sku'),
    barcode: text('barcode'),

    // المخزون
    trackInventory: boolean('track_inventory').notNull().default(true),
    stock: integer('stock').notNull().default(0),
    lowStockThreshold: integer('low_stock_threshold').notNull().default(5),
    allowBackorder: boolean('allow_backorder').notNull().default(false),

    // الشحن
    requiresShipping: boolean('requires_shipping').notNull().default(true),
    weightGrams: integer('weight_grams'),

    // المنتجات الرقمية
    digitalFileUrl: text('digital_file_url'),
    digitalDownloadLimit: integer('digital_download_limit'),

    // الحجوزات
    bookingEnabled: boolean('booking_enabled').notNull().default(false),
    bookingConfig: jsonb('booking_config').$type<{
      slotMinutes?: number
      leadHours?: number
      workingDays?: number[]
      workingHours?: { from: string; to: string }
    }>(),

    images: jsonb('images').$type<string[]>().notNull().default([]),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    specs: jsonb('specs').$type<Array<{ key: string; value: string }>>().notNull().default([]),

    isFeatured: boolean('is_featured').notNull().default(false),
    isBestSeller: boolean('is_best_seller').notNull().default(false),

    // إشارات ندرة تُعرض للعميل — قابلة للإطفاء لأن بعض التجار لا يريدها
    showStockCounter: boolean('show_stock_counter').notNull().default(false),
    showLiveViewers: boolean('show_live_viewers').notNull().default(false),

    seoTitle: text('seo_title'),
    seoDescription: text('seo_description'),

    ratingSum: integer('rating_sum').notNull().default(0),
    ratingCount: integer('rating_count').notNull().default(0),
    soldCount: integer('sold_count').notNull().default(0),
    viewCount: integer('view_count').notNull().default(0),

    sortOrder: integer('sort_order').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('products_store_slug_unique').on(t.storeId, t.slug),
    index('products_store_status_idx').on(t.storeId, t.status),
    index('products_category_idx').on(t.categoryId),
    index('products_sku_idx').on(t.storeId, t.sku),
  ],
)

/** خيار المنتج: «اللون»، «المقاس» */
export const productOptions = pgTable(
  'product_options',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    nameEn: text('name_en'),
    displayAs: text('display_as').$type<'swatch' | 'button' | 'dropdown'>().notNull().default('button'),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('product_options_product_idx').on(t.productId)],
)

/** قيمة الخيار: «أحمر» بكود لون، أو «XL» */
export const productOptionValues = pgTable(
  'product_option_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    optionId: uuid('option_id').notNull().references(() => productOptions.id, { onDelete: 'cascade' }),
    value: text('value').notNull(),
    valueEn: text('value_en'),
    hex: text('hex'),
    image: text('image'),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('product_option_values_option_idx').on(t.optionId)],
)

/** المتغيّر = تركيبة محددة من الخيارات، ولها سعر ومخزون مستقلّان. */
export const productVariants = pgTable(
  'product_variants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    title: text('title').notNull(), // «أحمر / XL»
    sku: text('sku'),
    barcode: text('barcode'),
    price: money('price'),
    compareAtPrice: moneyNullable('compare_at_price'),
    costPrice: moneyNullable('cost_price'),
    stock: integer('stock').notNull().default(0),
    weightGrams: integer('weight_grams'),
    image: text('image'),
    /** معرّفات قيم الخيارات المكوِّنة لهذا المتغيّر */
    optionValueIds: jsonb('option_value_ids').$type<string[]>().notNull().default([]),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    position: integer('position').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    index('product_variants_product_idx').on(t.productId),
    index('product_variants_store_idx').on(t.storeId),
  ],
)

/** مواقع التخزين — مستودعات متعددة لمن يحتاجها. */
export const inventoryLocations = pgTable(
  'inventory_locations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    address: text('address'),
    city: text('city'),
    phone: text('phone'),
    isDefault: boolean('is_default').notNull().default(false),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('inventory_locations_store_idx').on(t.storeId)],
)

export const inventoryLevels = pgTable(
  'inventory_levels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    locationId: uuid('location_id').notNull().references(() => inventoryLocations.id, { onDelete: 'cascade' }),
    variantId: uuid('variant_id').references(() => productVariants.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').references(() => products.id, { onDelete: 'cascade' }),
    available: integer('available').notNull().default(0),
    reserved: integer('reserved').notNull().default(0),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('inventory_levels_location_idx').on(t.locationId),
    uniqueIndex('inventory_levels_unique').on(t.locationId, t.variantId, t.productId),
  ],
)

/** حركة المخزون — سجل تدقيق يجيب على «المخزون راح فين؟» */
export const inventoryMovements = pgTable(
  'inventory_movements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    productId: uuid('product_id'),
    variantId: uuid('variant_id'),
    locationId: uuid('location_id'),
    delta: integer('delta').notNull(),
    reason: text('reason').$type<'order' | 'return' | 'manual' | 'import' | 'cancel' | 'restock'>().notNull(),
    referenceId: uuid('reference_id'),
    note: text('note'),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [index('inventory_movements_store_idx').on(t.storeId, t.createdAt)],
)

export const reviews = pgTable(
  'reviews',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull().references(() => products.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id'),
    orderId: uuid('order_id'),
    authorName: text('author_name').notNull(),
    rating: integer('rating').notNull(),
    title: text('title'),
    body: text('body'),
    images: jsonb('images').$type<string[]>().notNull().default([]),
    isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(false),
    isApproved: boolean('is_approved').notNull().default(false),
    merchantReply: text('merchant_reply'),
    createdAt: createdAt(),
  },
  (t) => [
    index('reviews_product_idx').on(t.productId, t.isApproved),
    index('reviews_store_idx').on(t.storeId),
  ],
)
