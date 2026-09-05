import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { stores } from './tenancy'
import { createdAt, updatedAt, money } from './_shared'

export type LoyaltyTier = 'bronze' | 'silver' | 'gold' | 'platinum'

/**
 * عميل المتجر — منفصل تمامًا عن جدول users (أصحاب المتاجر).
 * العميل يخصّ متجرًا واحدًا: نفس الرقم في متجرين = صفّان مختلفان،
 * وده مقصود عشان ما تتسربش بيانات عملاء بين التجار.
 */
export const customers = pgTable(
  'customers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),

    name: text('name'),
    phone: text('phone'),
    email: text('email'),
    passwordHash: text('password_hash'),

    phoneVerifiedAt: timestamp('phone_verified_at', { withTimezone: true }),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),

    // الولاء
    points: integer('points').notNull().default(0),
    lifetimePoints: integer('lifetime_points').notNull().default(0),
    tier: text('tier').$type<LoyaltyTier>().notNull().default('bronze'),

    /*
      كود الإحالة — ثابت لكل عميل عشان يقدر يشاركه على واتساب مرة
      ويفضل شغّال. بيتولّد أول ما يفتح حسابه لا وقت التسجيل: أغلب
      العملاء ما بيحيلوش حد، فما نملاش الجدول أكوادًا ما اتشافتش.
    */
    referralCode: text('referral_code'),

    // إحصاءات محسوبة — تُحدَّث مع كل طلب لتفادي استعلامات ثقيلة
    ordersCount: integer('orders_count').notNull().default(0),
    totalSpent: money('total_spent'),
    lastOrderAt: timestamp('last_order_at', { withTimezone: true }),

    acceptsMarketing: boolean('accepts_marketing').notNull().default(true),
    /**
     * رمز إلغاء الاشتراك — مخزَّن كهاش زي أي رمز.
     *
     * جيميل بيشترط «إلغاء بضغطة واحدة» على المرسلين، والترويسة لازم
     * تشاور على عنوان بيشتغل فعلًا. والرمز مش معرّف العميل: من غير
     * كده أي حد يعدّ المعرّفات ويلغي اشتراك عملاء متجر مش بتاعه.
     */
    unsubscribeToken: text('unsubscribe_token'),
    tags: jsonb('tags').$type<string[]>().notNull().default([]),
    note: text('note'),
    isBlocked: boolean('is_blocked').notNull().default(false),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('customers_store_phone_unique').on(t.storeId, t.phone),
    uniqueIndex('customers_store_email_unique').on(t.storeId, t.email),
    index('customers_store_idx').on(t.storeId),
    index('customers_unsubscribe_idx').on(t.unsubscribeToken),
    index('customers_tier_idx').on(t.storeId, t.tier),
  ],
)

export const customerAddresses = pgTable(
  'customer_addresses',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    label: text('label'),
    name: text('name'),
    phone: text('phone'),
    country: text('country').notNull().default('EG'),
    city: text('city'),
    area: text('area'),
    street: text('street'),
    building: text('building'),
    postalCode: text('postal_code'),
    notes: text('notes'),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index('customer_addresses_customer_idx').on(t.customerId)],
)

/** جلسة عميل المتجر — كوكي موقّع مربوط بالمتجر ولا يصلح في متجر آخر. */
export const customerSessions = pgTable(
  'customer_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    userAgent: text('user_agent'),
    ip: text('ip'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /**
     * آخر نشاط.
     *
     * الجلسة بتموت بعد ٢٤ ساعة سكون حتى لو صلاحيتها لسه طويلة.
     * جهاز مشترك أو موبايل ضايع ما ينفعش يفضل فاتح على حساب فيه
     * عناوين العميل وتاريخ طلباته لشهرين.
     */
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('customer_sessions_token_unique').on(t.tokenHash),
    index('customer_sessions_customer_idx').on(t.customerId),
  ],
)

/** قائمة الأمنيات */
export const wishlists = pgTable(
  'wishlists',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').notNull().references(() => customers.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('wishlists_unique').on(t.customerId, t.productId)],
)

/** نوع البيانات اللي الحظر بيتطابق عليه */
export type BlockMatch = 'phone' | 'email' | 'ip' | 'name'

/**
 * قايمة الحظر — منع الطلبات الوهمية قبل ما تتحوّل لشحنة.
 *
 * ## ليه دي غير `customers.isBlocked`
 * العلم اللي على العميل بيمنع **حساب موجود**. لكن أغلب الطلبات
 * الوهمية بتيجي من ضيف أول مرة يطلب: رقم جديد، بلا حساب، وبيرفض
 * الاستلام. الصف هنا بيمسك القيمة نفسها — الرقم أو البريد أو
 * العنوان — قبل ما يتعمل له صف عميل أصلًا.
 *
 * ## ليه الحظر ملهوش «رفض صامت» بس
 * التاجر بيختار: يرفض الطلب من أوله، أو يقبله ويعلّم عليه ويراجعه
 * بإيده. التاني ده مهم في السوق ده: رقم واحد ممكن يكون العيلة كلها
 * بتطلب منه، ورفضه بيخسّر التاجر بيع حقيقي — فبيسيبه يعدّي ويبص
 * عليه هو.
 */
export const blocklist = pgTable(
  'blocklist',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),

    match: text('match').$type<BlockMatch>().notNull().default('phone'),
    /**
     * القيمة — مخزّنة **مطبّعة** (حروف صغيرة، والرقم بصيغة موحّدة).
     *
     * من غير التطبيع، التاجر بيحظر «01001234567» والعميل بيكتب
     * «+201001234567» ويعدّي — ويفضل التاجر شايف الحظر مسجّل ومش
     * فاهم ليه مش شغّال.
     */
    value: text('value').notNull(),

    /** يرفض الطلب، ولا يقبله ويعلّم عليه للمراجعة */
    action: text('action').$type<'reject' | 'flag'>().notNull().default('reject'),
    reason: text('reason'),

    /** عدد المرات اللي الصف ده منع فيها طلبًا — بيقول للتاجر إن له لازمة */
    hits: integer('hits').notNull().default(0),
    lastHitAt: timestamp('last_hit_at', { withTimezone: true }),

    createdBy: uuid('created_by'),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('blocklist_store_value_unique').on(t.storeId, t.match, t.value),
    index('blocklist_store_idx').on(t.storeId),
  ],
)

/* ────────────────────────── الشكاوى ────────────────────────── */

export type TicketStatus = 'open' | 'answered' | 'resolved' | 'closed'
export type TicketCategory = 'order' | 'product' | 'shipping' | 'payment' | 'other'

/**
 * شكوى من العميل للتاجر.
 *
 * ## المشكلة اللي بيحلّها الجدول ده
 * شكاوى عملاء التاجر بتيجي على واتساب وسط مية رسالة تانية. اللي
 * بيرد بيرد من موبايله الشخصي، واللي مبيردّش محدّش بيعرف إنه
 * موجود أصلًا — العميل بيزعل ويمشي في صمت، والتاجر بيفتكر إن
 * كل حاجة تمام لأن مفيش حد بيشتكي «رسميًا».
 *
 * الشكوى هنا ليها **رقم وحالة ومكان واحد**: التاجر بيفتح شاشة
 * واحدة ويشوف اللي مستني رد، والموظف بياخدها بصلاحية `orders.view`
 * من غير ما يشوف أرباح ولا مصروفات.
 *
 * ## ومربوطة بالطلب لما تكون عن طلب
 * `orderId` اختياري: فيه شكاوى عن طلب («وصلني مكسور») وفيه شكاوى
 * عامة («بتشحنوا لأسوان؟»). لما تكون عن طلب، التاجر بيفتح الطلب
 * من الشكوى مباشرةً بدل ما يدوّر عليه برقم بيسأل عنه العميل.
 *
 * ## واللقطة على الصف زي الطلب بالظبط
 * الاسم والتليفون والبريد بيتخزّنوا على الشكوى: العميل اللي غيّر
 * رقمه بعد شهر، سجل الشكوى بيفضل بيقول اتكلّمنا مع مين وعلى أنهي
 * رقم — وده اللي بيحسم أي خلاف.
 */
export const supportTickets = pgTable(
  'support_tickets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    /** رقم متسلسل لكل متجر — العميل والتاجر بيتكلّموا بيه */
    ticketNumber: integer('ticket_number').notNull(),

    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
    /** الطلب اللي الشكوى عنه — فاضي لو الشكوى عامة */
    orderId: uuid('order_id'),

    subject: text('subject').notNull(),
    category: text('category').$type<TicketCategory>().notNull().default('other'),
    status: text('status').$type<TicketStatus>().notNull().default('open'),

    // لقطة وقت الفتح — الطلب سجل تاريخي والشكوى زيه
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    customerEmail: text('customer_email'),

    /**
     * آخر رسالة كانت من مين — **العمود ده هو ترتيب الشاشة**.
     *
     * «مستنية رد مني» غير «ردّيت ومستني العميل». من غيره التاجر
     * بيفتح كل شكوى عشان يعرف دور مين — وشكوى واحدة اتنست معناها
     * عميل ضاع.
     */
    lastMessageBy: text('last_message_by').$type<'customer' | 'merchant'>().notNull().default('customer'),
    lastMessageAt: timestamp('last_message_at', { withTimezone: true }).notNull().defaultNow(),

    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('support_tickets_store_number_unique').on(t.storeId, t.ticketNumber),
    index('support_tickets_store_status_idx').on(t.storeId, t.status, t.lastMessageAt),
    index('support_tickets_customer_idx').on(t.customerId),
  ],
)

/** رسالة جوّه شكوى — من العميل أو من التاجر */
export const supportMessages = pgTable(
  'support_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ticketId: uuid('ticket_id').notNull().references(() => supportTickets.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),

    body: text('body').notNull(),
    author: text('author').$type<'customer' | 'merchant'>().notNull(),
    /** موظف التاجر اللي رد — عشان التاجر يعرف مين رد على مين */
    authorUserId: uuid('author_user_id'),
    authorName: text('author_name'),

    /** صور العميل — «وصلني مكسور» بصورة بتوفّر عشر رسايل */
    images: jsonb('images').$type<string[]>().notNull().default([]),

    createdAt: createdAt(),
  },
  (t) => [index('support_messages_ticket_idx').on(t.ticketId, t.createdAt)],
)
