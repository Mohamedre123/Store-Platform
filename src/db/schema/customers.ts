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
