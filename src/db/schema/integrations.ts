import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { stores } from './tenancy'
import { createdAt, updatedAt, money } from './_shared'

/**
 * الإضافات المفعّلة لكل متجر.
 * كتالوج الإضافات نفسه مُعرَّف في الكود (src/plugins/registry.ts) وليس في قاعدة
 * البيانات — عشان يبقى مكتوبًا بأنواع TypeScript ويتغيّر مع النشر لا بتعديل صفوف.
 * هنا نخزّن حالة التفعيل وإعدادات كل متجر فقط.
 */
export const storePlugins = pgTable(
  'store_plugins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    pluginSlug: text('plugin_slug').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    /** إعدادات عامة — تُقرأ في المتصفح بأمان */
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    /** أسرار مشفّرة (مفاتيح API، توكنات) — لا تُرسل للعميل أبدًا */
    secrets: text('secrets'),
    lastError: text('last_error'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    installedAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('store_plugins_unique').on(t.storeId, t.pluginSlug),
    index('store_plugins_store_idx').on(t.storeId, t.enabled),
  ],
)

/** طرق الدفع المفعّلة */
export const paymentMethods = pgTable(
  'payment_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    /** cod | manual | paymob | fawry | kashier | tabby | tamara | stripe | paypal ... */
    gateway: text('gateway').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    displayName: text('display_name'),
    instructions: text('instructions'),
    credentials: text('credentials'), // مشفّرة
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    /** رسوم إضافية أو خصم بنقاط الأساس — سالب = خصم */
    feeBps: integer('fee_bps').notNull().default(0),
    fixedFee: money('fixed_fee'),
    testMode: boolean('test_mode').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('payment_methods_unique').on(t.storeId, t.gateway),
    index('payment_methods_store_idx').on(t.storeId, t.enabled),
  ],
)

/** سجل محاولات الدفع — ضروري لتتبّع المشاكل مع البوابات */
export const paymentAttempts = pgTable(
  'payment_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id'),
    gateway: text('gateway').notNull(),
    amount: money('amount'),
    currency: text('currency').notNull().default('EGP'),
    status: text('status').$type<'created' | 'redirected' | 'succeeded' | 'failed' | 'cancelled'>().notNull().default('created'),
    reference: text('reference'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    request: jsonb('request').$type<Record<string, unknown>>(),
    response: jsonb('response').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index('payment_attempts_order_idx').on(t.orderId),
    index('payment_attempts_store_idx').on(t.storeId, t.createdAt),
  ],
)

/** مناطق الشحن — دولة لكل صف */
export const shippingZones = pgTable(
  'shipping_zones',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    country: text('country').notNull(),
    name: text('name'),
    enabled: boolean('enabled').notNull().default(true),
    defaultPrice: money('default_price'),
    freeOverAmount: money('free_over_amount'),
    freeShippingEnabled: boolean('free_shipping_enabled').notNull().default(false),
    minDays: integer('min_days').notNull().default(2),
    maxDays: integer('max_days').notNull().default(5),
    codEnabled: boolean('cod_enabled').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('shipping_zones_unique').on(t.storeId, t.country),
    index('shipping_zones_store_idx').on(t.storeId),
  ],
)

/** سعر الشحن لكل محافظة/مدينة داخل الدولة */
export const shippingRates = pgTable(
  'shipping_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    zoneId: uuid('zone_id').notNull().references(() => shippingZones.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    city: text('city').notNull(),
    cityEn: text('city_en'),
    price: money('price'),
    minDays: integer('min_days'),
    maxDays: integer('max_days'),
    enabled: boolean('enabled').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
  },
  (t) => [
    index('shipping_rates_zone_idx').on(t.zoneId),
    uniqueIndex('shipping_rates_unique').on(t.zoneId, t.city),
  ],
)

/**
 * مندوبو التاجر نفسه — مش شركة شحن.
 *
 * ## المشكلة اللي بيحلّها الجدول ده
 * أغلب التجّار في مصر بيوصّلوا بمندوب بتاعهم: واحد أو اتنين
 * بموتوسيكل بيلفّوا على العناوين ويحصّلوا الفلوس. النظام كله عندنا
 * كان مبنيًّا على «شركة شحن ليها API» — فالتاجر ده كان بيسجّل
 * شحناته «شركة تانية» بلا اسم ولا رقم ولا حساب، وبيفضل يتابع
 * مندوبه على ورقة.
 *
 * ## والمندوب مش صف في جدول الشحنات
 * الشحنة حدث بيحصل مرة، والمندوب بيفضل شهور: ليه مناطق بيغطّيها،
 * وأجرة بياخدها على الطلب، وحساب فلوس بيتقفل آخر اليوم. لو خزّنّا
 * اسمه على كل شحنة، تغيير رقم تليفونه كان هيحتاج يعدّي على كل
 * شحنة عملها من أول يوم.
 *
 * ## الأجرة على الطلب لا نسبة
 * المندوب في السوق ده بياخد مبلغًا ثابتًا على التوصيلة، مش نسبة من
 * قيمة الطلب. النسبة كانت هتخلّي توصيل طلب بألف جنيه لنفس البيت
 * يتكلّف عشر أضعاف توصيل طلب بمية — وده مش اللي بيحصل.
 */
export const couriers = pgTable(
  'couriers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    phone: text('phone').notNull(),
    vehicle: text('vehicle').$type<'motorcycle' | 'car' | 'van' | 'foot'>().notNull().default('motorcycle'),

    /** المناطق اللي بيغطّيها — نفس أسماء المدن في `shipping_rates` */
    zones: jsonb('zones').$type<string[]>().notNull().default([]),

    /** أجرته على الطلب الواحد، بالقرش */
    feePerOrder: money('fee_per_order'),

    /**
     * رمز صفحته — بيفتح بيه قايمة طلباته من موبايله.
     *
     * ## ليه رابط مش حساب
     * المندوب مش هيعمل حساب ولا هيفتكر باسورد. الرابط بيتبعتله على
     * واتساب مرة، وبيفضل مفتوح على موبايله طول اليوم.
     *
     * ## والرمز ده بيفتح بيانات عملاء
     * أسماء وتليفونات وعناوين اللي عندهم طلبات معاه — وده اللي
     * المندوب محتاجه عشان يوصّل أصلًا. عشان كده:
     * - الرمز طويل وعشوائي مش رقم متسلسل
     * - بيتغيّر بضغطة لما التاجر يستغنى عنه، فالرابط القديم يموت
     * - وما بيوريش غير الطلبات المسنودة له هو، اللي لسه في الطريق بس
     */
    accessToken: text('access_token').notNull(),

    isActive: boolean('is_active').notNull().default(true),
    note: text('note'),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('couriers_token_unique').on(t.accessToken),
    index('couriers_store_idx').on(t.storeId, t.isActive),
  ],
)

/** الشحنات المُنشأة عند شركات الشحن */
export const shipments = pgTable(
  'shipments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id').notNull(),
    carrier: text('carrier').notNull(), // bosta | mylerz | jt | wavex | sprint | r2s | internal

    /**
     * مندوب التاجر اللي ماشي بالشحنة — لما `carrier = 'internal'`.
     *
     * على الشحنة لا على الطلب: الطلب اللي رجع واتبعت تاني ممكن
     * يمشي مع مندوب غير الأول، والتاريخ ده لازم يفضل مقروءًا عشان
     * حساب كل واحد فيهم يقفل صح.
     */
    courierId: uuid('courier_id'),
    trackingNumber: text('tracking_number'),
    carrierShipmentId: text('carrier_shipment_id'),
    awbUrl: text('awb_url'),
    status: text('status').notNull().default('created'),
    carrierStatus: text('carrier_status'),
    codAmount: money('cod_amount'),
    shippingCost: money('shipping_cost'),
    isCodCollected: boolean('is_cod_collected').notNull().default(false),
    settledAt: timestamp('settled_at', { withTimezone: true }),
    events: jsonb('events').$type<Array<{ at: string; status: string; note?: string }>>().notNull().default([]),
    raw: jsonb('raw').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('shipments_order_idx').on(t.orderId),
    index('shipments_store_idx').on(t.storeId, t.status),
    index('shipments_tracking_idx').on(t.trackingNumber),
    index('shipments_courier_idx').on(t.courierId, t.status),
  ],
)

/** مفاتيح الـAPI للتجار — لربط أنظمتهم الخارجية */
export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    /** نخزّن الهاش فقط — المفتاح الخام يظهر مرة واحدة عند الإنشاء */
    keyHash: text('key_hash').notNull(),
    prefix: text('prefix').notNull(),
    scopes: jsonb('scopes').$type<string[]>().notNull().default([]),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('api_keys_hash_unique').on(t.keyHash),
    index('api_keys_store_idx').on(t.storeId),
  ],
)

/** ويب هوكس صادرة للتجار */
export const webhooks = pgTable(
  'webhooks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    events: jsonb('events').$type<string[]>().notNull().default([]),
    secret: text('secret').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    failureCount: integer('failure_count').notNull().default(0),
    lastDeliveryAt: timestamp('last_delivery_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('webhooks_store_idx').on(t.storeId)],
)

/** مزامنة الكتالوج مع الأسواق ومنصات الإعلانات */
export const marketplaceConnections = pgTable(
  'marketplace_connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(), // meta | amazon | noon | jumia | google
    enabled: boolean('enabled').notNull().default(false),
    credentials: text('credentials'),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    syncPrices: boolean('sync_prices').notNull().default(true),
    syncStock: boolean('sync_stock').notNull().default(true),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastError: text('last_error'),
    syncedCount: integer('synced_count').notNull().default(0),
    errorCount: integer('error_count').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('marketplace_connections_unique').on(t.storeId, t.platform)],
)

/** موردو الدروب شيبينج */
export const suppliers = pgTable(
  'suppliers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    phone: text('phone'),
    email: text('email'),
    type: text('type').$type<'manual' | 'api' | 'feed'>().notNull().default('manual'),
    feedUrl: text('feed_url'),
    credentials: text('credentials'),
    defaultMarginBps: integer('default_margin_bps').notNull().default(3000),
    autoFulfill: boolean('auto_fulfill').notNull().default(false),
    productCount: integer('product_count').notNull().default(0),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('suppliers_store_idx').on(t.storeId)],
)

/**
 * حساب التاجر عند شركة شحن.
 *
 * نفس شكل `paymentMethods` عن قصد: الاتنين «مزوّد خارجي بمفاتيح
 * التاجر»، فالتعامل معاهم في اللوحة والتحقق منهم بيمشي بنفس المنطق.
 *
 * `credentials` مشفّرة زي كل الأسرار. `config` للإعدادات اللي مش
 * سرّ (وضع تجريبي، مكان الاستلام) — دي بتتقرا في اللوحة.
 */
export const carrierAccounts = pgTable(
  'carrier_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    /** bosta | mylerz | jt | aramex | r2s | sprint | wavex */
    carrier: text('carrier').notNull(),
    enabled: boolean('enabled').notNull().default(false),
    displayName: text('display_name'),
    credentials: text('credentials'),
    config: jsonb('config').$type<Record<string, unknown>>().notNull().default({}),
    testMode: boolean('test_mode').notNull().default(true),
    /**
     * سعر ثابت بالوحدة الصغرى لما الشركة مش بترجّع تسعير.
     * الشركات اللي بترجّع سعر بيغلب ده.
     */
    flatRate: money('flat_rate'),
    /** الشحن مجاني فوق المبلغ ده — صفر يعني مفيش */
    freeOver: money('free_over'),
    /** آخر خطأ من الشركة — بيظهر للتاجر على الكارت */
    lastError: text('last_error'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('carrier_accounts_unique').on(t.storeId, t.carrier),
    index('carrier_accounts_store_idx').on(t.storeId, t.enabled),
  ],
)

/**
 * طرق شحن متعددة — «عادي» و«سريع» و«نفس اليوم».
 *
 * ## ليه فرق سعر لا سعر كامل
 * التاجر سعّر ٢٧ محافظة مرة واحدة. لو كل طريقة شحن طلبت تسعيرة
 * كاملة، إضافة «سريع» معناها ٢٧ سطر تاني يتكتبوا بإيد — وأول تغيير
 * في التعريفة معناه تعديلهم كلهم في مكانين.
 *
 * الفرق بيتضاف على سعر المحافظة: «سريع = +٣٠ جنيه» بتشتغل على كل
 * المحافظات في سطر واحد، وبتفضل صح لما التاجر يغيّر سعر محافظة.
 *
 * ## والفرق ممكن يكون بالسالب
 * «استلام من فرعنا» أو «شحن اقتصادي» بيقلّلوا السعر. الحساب بيقصّ
 * عند صفر — الشحن السالب معناه إن التاجر بيدفع للعميل عشان يشتري.
 *
 * ## ومفيش طرق = السلوك القديم بالحرف
 * الجدول الفاضي معناه سعر واحد زي ما كان. الميزة بتتفتح لما التاجر
 * يضيف أول طريقة، ولحد ساعتها مفيش أي تغيير في الشيك أوت.
 */
export const shippingMethods = pgTable(
  'shipping_methods',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),

    name: text('name').notNull(),
    /** سطر تحت الاسم — «يوصلك خلال ٢٤ ساعة» */
    hint: text('hint'),

    /** فرق السعر بالقرش — موجب أو سالب أو صفر */
    priceDelta: integer('price_delta').notNull().default(0),

    /**
     * مدة التوصيل بالأيام — بتغلب مدة المحافظة لما تتكتب.
     *
     * الطريقة السريعة سبب وجودها إنها أسرع؛ لو ورّينا مدة المحافظة
     * جنبها، العميل بيدفع زيادة وبيقرا نفس الميعاد.
     */
    minDays: integer('min_days'),
    maxDays: integer('max_days'),

    enabled: boolean('enabled').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('shipping_methods_store_idx').on(t.storeId, t.sortOrder)],
)
