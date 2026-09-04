import { pgTable, uuid, text, integer, jsonb, timestamp, index, date, uniqueIndex, boolean } from 'drizzle-orm/pg-core'
import { stores } from './tenancy'
import { createdAt, money, updatedAt } from './_shared'

export type StoreEventType =
  | 'page_view'
  | 'product_view'
  | 'add_to_cart'
  | 'remove_from_cart'
  | 'begin_checkout'
  | 'add_payment_info'
  | 'purchase'
  | 'search'
  | 'whatsapp_click'
  | 'funnel_view'

/**
 * أحداث المتجر الخام. تُستخدم لتقارير الزيارات والقُمع،
 * ولإرسال أحداث البكسل من السيرفر (CAPI) بنفس event_id.
 */
export const storeEvents = pgTable(
  'store_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    type: text('type').$type<StoreEventType>().notNull(),
    /** يُشارَك بين المتصفح والسيرفر لمنع ازدواج الأحداث عند منصات الإعلانات */
    eventId: text('event_id'),
    sessionId: text('session_id'),
    customerId: uuid('customer_id'),
    productId: uuid('product_id'),
    orderId: uuid('order_id'),
    funnelId: uuid('funnel_id'),
    path: text('path'),
    referrer: text('referrer'),
    value: money('value'),
    currency: text('currency'),
    utm: jsonb('utm').$type<Record<string, string>>(),
    device: text('device').$type<'mobile' | 'tablet' | 'desktop'>(),
    os: text('os'),
    browser: text('browser'),
    country: text('country'),
    city: text('city'),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index('store_events_store_type_idx').on(t.storeId, t.type, t.createdAt),
    index('store_events_session_idx').on(t.sessionId),
    index('store_events_product_idx').on(t.productId),
  ],
)

/**
 * تجميعة يومية جاهزة. الاستعلام على الجدول الخام يبطؤ بعد ملايين الصفوف،
 * فنحسب مرة في اليوم ونقرأ من هنا في لوحة التحكم.
 */
export const dailyStats = pgTable(
  'daily_stats',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    day: date('day').notNull(),

    visitors: integer('visitors').notNull().default(0),
    pageViews: integer('page_views').notNull().default(0),
    productViews: integer('product_views').notNull().default(0),
    addToCarts: integer('add_to_carts').notNull().default(0),
    checkoutsStarted: integer('checkouts_started').notNull().default(0),

    orders: integer('orders').notNull().default(0),
    incompleteOrders: integer('incomplete_orders').notNull().default(0),
    recoveredOrders: integer('recovered_orders').notNull().default(0),
    cancelledOrders: integer('cancelled_orders').notNull().default(0),
    returnedOrders: integer('returned_orders').notNull().default(0),

    revenue: money('revenue'),
    cogs: money('cogs'),
    shippingCost: money('shipping_cost'),
    discounts: money('discounts'),
    /** الربح الحقيقي = الإيراد − التكلفة − الشحن − الخصومات − رسوم البوابة */
    netProfit: money('net_profit'),

    newCustomers: integer('new_customers').notNull().default(0),
    returningCustomers: integer('returning_customers').notNull().default(0),

    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('daily_stats_unique').on(t.storeId, t.day),
    index('daily_stats_store_day_idx').on(t.storeId, t.day),
  ],
)

/** سجل تدقيق لكل إجراء حسّاس في اللوحة */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').references(() => stores.id, { onDelete: 'cascade' }),
    userId: uuid('user_id'),
    apiKeyId: uuid('api_key_id'),
    action: text('action').notNull(),
    resource: text('resource'),
    resourceId: text('resource_id'),
    before: jsonb('before').$type<Record<string, unknown>>(),
    after: jsonb('after').$type<Record<string, unknown>>(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_log_store_idx').on(t.storeId, t.createdAt)],
)

/** جلسات لوحة التحكم */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').notNull(),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('sessions_token_unique').on(t.tokenHash),
    index('sessions_user_idx').on(t.userId),
  ],
)

/** رموز التحقق من البريد وإعادة تعيين كلمة المرور */
export const verificationTokens = pgTable(
  'verification_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    tokenHash: text('token_hash').notNull(),
    purpose: text('purpose').$type<'email_verify' | 'password_reset' | 'invite'>().notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('verification_tokens_hash_unique').on(t.tokenHash),
    index('verification_tokens_identifier_idx').on(t.identifier, t.purpose),
  ],
)

/** اشتراك المتجر في المنصة */
export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    plan: text('plan').notNull().default('standard'),
    status: text('status').$type<'trialing' | 'active' | 'past_due' | 'cancelled'>().notNull().default('trialing'),
    amount: money('amount'),
    currency: text('currency').notNull().default('EGP'),
    interval: text('interval').$type<'month' | 'year'>().notNull().default('month'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    autoRenew: boolean('auto_renew').notNull().default(true),
    paymentReference: text('payment_reference'),
    createdAt: createdAt(),
  },
  (t) => [index('subscriptions_store_idx').on(t.storeId, t.status)],
)

/**
 * تصنيفات المصروفات — **قايمة ثابتة لا يبنيها التاجر**.
 *
 * السبب مش تبسيط: التاجر اللي بيبدأ متجره ما عندوش وقت يصمّم شجرة
 * حسابات، ولو سبناها له كل واحد هيكتب «إعلانات» و«اعلانات» و«ads»
 * وتقاريره تطلع مقسّمة على تلاتة. القايمة الثابتة معناها إن التقرير
 * بيشتغل من أول مصروف من غير أي إعداد — واسم المصروف نفسه حرّ
 * فالتفصيلة اللي عايزها بتتكتب فيه.
 *
 * والتصنيفات دي مختارة من مصاريف السوق المصري الفعلية: الإعلانات
 * أكبر بند عند أغلب التجّار، ومرتجعات الشحن بند ما بيبانش في أي
 * مكان تاني وبياكل الربح بهدوء.
 */
export type ExpenseCategory =
  | 'ads'        // إعلانات — أكبر بند وأول ما التاجر يدوّر عليه
  | 'shipping'   // شحن ومرتجعات مدفوعة للشركة
  | 'goods'      // شراء بضاعة من الموردين
  | 'salaries'   // مرتبات وعمولات
  | 'rent'       // إيجار ومرافق
  | 'packaging'  // تغليف ومطبوعات
  | 'fees'       // رسوم بوابات واشتراكات
  | 'other'

/**
 * مصروفات المتجر.
 *
 * ## ليه دي مش «ميزة محاسبة»
 * الطلب عندنا شايل تكلفة بضاعته (`orders.costTotal`)، يعني مجمل
 * الربح محسوب صح من غير أي إدخال. اللي ناقص هو المصروف اللي مالوش
 * علاقة بطلب معيّن — الإعلانات والإيجار والمرتبات — وده اللي بيخلّي
 * تاجر «رابح» على الورق يقفل آخر الشهر وهو خسران.
 *
 * فالجدول ده بند واحد بسيط: كام، امتى، على إيه. ومن غيره رقم
 * «صافي الربح» في التحليلات بيبقى كذبة مريحة.
 */
export const expenses = pgTable(
  'expenses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),

    title: text('title').notNull(),
    category: text('category').$type<ExpenseCategory>().notNull().default('other'),
    amount: money('amount'),

    /**
     * تاريخ الصرف لا تاريخ التسجيل.
     *
     * التاجر بيسجّل مصاريف الأسبوع يوم الخميس. لو حسبناها بتاريخ
     * الإدخال، كل مصاريفه بتقع في يوم واحد وتقرير الربح اليومي
     * بيطلع سنّة منشار مالهاش معنى.
     */
    spentAt: timestamp('spent_at', { withTimezone: true }).notNull().defaultNow(),

    note: text('note'),
    /** صورة الإيصال — بترفع على نفس التخزين بتاع صور المنتجات */
    receiptUrl: text('receipt_url'),

    /**
     * مصروف بيتكرر كل شهر (إيجار، اشتراك، مرتب).
     *
     * العلامة دي **ما بتولّدش صفوفًا لوحدها**: بتخلّي الشاشة تفكّر
     * التاجر بيه أول كل شهر. التوليد التلقائي كان هيسجّل مصاريف
     * محصلتش — والتاجر اللي وقّف الاشتراك بيلاقي فلوسه ناقصة في
     * تقرير مالوش يد فيه.
     */
    isRecurring: boolean('is_recurring').notNull().default(false),

    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('expenses_store_date_idx').on(t.storeId, t.spentAt),
    index('expenses_store_category_idx').on(t.storeId, t.category),
  ],
)
