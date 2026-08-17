import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, index } from 'drizzle-orm/pg-core'
import { stores } from './tenancy'
import { createdAt, updatedAt, money } from './_shared'

export type TierConfig = {
  key: 'bronze' | 'silver' | 'gold' | 'platinum'
  name: string
  minPoints: number
  color: string
  perks: string[]
  discountBps: number
}

export const loyaltySettings = pgTable('loyalty_settings', {
  storeId: uuid('store_id')
    .primaryKey()
    .references(() => stores.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false),

  /** نقاط تُمنح لكل وحدة عملة صغرى مُنفَقة — 1 نقطة لكل جنيه = 1 لكل 100 قرش */
  pointsPerUnit: integer('points_per_unit').notNull().default(1),
  unitAmount: money('unit_amount'), // مقدار الإنفاق المقابل (افتراضيًا 100 = جنيه)
  /** قيمة النقطة الواحدة عند الاستبدال، بالوحدة الصغرى */
  pointValue: integer('point_value').notNull().default(1),
  minPointsToRedeem: integer('min_points_to_redeem').notNull().default(100),

  pointsExpireAfterDays: integer('points_expire_after_days'),
  earnOnDelivery: boolean('earn_on_delivery').notNull().default(true),

  welcomePoints: integer('welcome_points').notNull().default(0),
  reviewPoints: integer('review_points').notNull().default(0),
  referralPoints: integer('referral_points').notNull().default(0),
  birthdayPoints: integer('birthday_points').notNull().default(0),

  tiers: jsonb('tiers').$type<TierConfig[]>().notNull().default([]),

  // تطبيق الولاء (PWA)
  appEnabled: boolean('app_enabled').notNull().default(false),
  appSlug: text('app_slug'),
  showTierProgress: boolean('show_tier_progress').notNull().default(true),

  updatedAt: updatedAt(),
})

export const loyaltyTransactions = pgTable(
  'loyalty_transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id').notNull(),
    points: integer('points').notNull(),
    balanceAfter: integer('balance_after').notNull().default(0),
    type: text('type').$type<'earn' | 'redeem' | 'expire' | 'manual' | 'refund'>().notNull(),
    reason: text('reason'),
    orderId: uuid('order_id'),
    rewardId: uuid('reward_id'),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('loyalty_tx_customer_idx').on(t.customerId, t.createdAt),
    index('loyalty_tx_store_idx').on(t.storeId),
  ],
)

export const rewards = pgTable(
  'rewards',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    image: text('image'),
    type: text('type').$type<'coupon_percent' | 'coupon_fixed' | 'free_shipping' | 'free_product'>().notNull(),
    /** نسبة بنقاط الأساس أو مبلغ بالوحدة الصغرى أو معرّف منتج */
    value: integer('value').notNull().default(0),
    productId: uuid('product_id'),
    pointsCost: integer('points_cost').notNull(),
    minTier: text('min_tier').$type<'bronze' | 'silver' | 'gold' | 'platinum'>(),
    stock: integer('stock'),
    redeemedCount: integer('redeemed_count').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index('rewards_store_idx').on(t.storeId, t.isActive)],
)

/** عجلة الحظ */
export const wheelSettings = pgTable('wheel_settings', {
  storeId: uuid('store_id')
    .primaryKey()
    .references(() => stores.id, { onDelete: 'cascade' }),
  enabled: boolean('enabled').notNull().default(false),
  title: text('title').notNull().default('جرّب حظك'),
  subtitle: text('subtitle'),
  spinCost: integer('spin_cost').notNull().default(0), // بالنقاط
  freeSpinsPerDay: integer('free_spins_per_day').notNull().default(1),
  requirePhone: boolean('require_phone').notNull().default(true),
  showOnStorefront: boolean('show_on_storefront').notNull().default(false),
  triggerAfterSeconds: integer('trigger_after_seconds').notNull().default(15),
  updatedAt: updatedAt(),
})

export const wheelPrizes = pgTable(
  'wheel_prizes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    label: text('label').notNull(),
    color: text('color').notNull().default('#4C3A78'),
    type: text('type').$type<'points' | 'coupon_percent' | 'coupon_fixed' | 'free_shipping' | 'nothing'>().notNull(),
    value: integer('value').notNull().default(0),
    /** الاحتمال بنقاط الأساس — مجموع كل الجوائز يجب أن يساوي 10000 */
    probabilityBps: integer('probability_bps').notNull().default(1000),
    dailyLimit: integer('daily_limit'),
    wonCount: integer('won_count').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),
    position: integer('position').notNull().default(0),
  },
  (t) => [index('wheel_prizes_store_idx').on(t.storeId)],
)

export const wheelSpins = pgTable(
  'wheel_spins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    customerId: uuid('customer_id'),
    phone: text('phone'),
    prizeId: uuid('prize_id'),
    prizeLabel: text('prize_label'),
    couponCode: text('coupon_code'),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('wheel_spins_store_idx').on(t.storeId, t.createdAt),
    index('wheel_spins_phone_idx').on(t.storeId, t.phone),
  ],
)
