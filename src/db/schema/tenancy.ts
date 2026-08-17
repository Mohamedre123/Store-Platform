import { pgTable, uuid, text, boolean, integer, timestamp, jsonb, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { createdAt, updatedAt, deletedAt } from './_shared'

export type StoreStatus = 'trial' | 'active' | 'past_due' | 'suspended'
export type MemberRole = 'owner' | 'admin' | 'staff'
export type AddressMode = 'structured' | 'simple' | 'hidden'
export type FieldMode = 'required' | 'optional' | 'hidden'

/**
 * المستخدم = صاحب حساب في المنصة. مفصول عن المتجر عمدًا،
 * عشان الشخص الواحد يقدر يملك أكتر من متجر بحساب واحد —
 * دي حاجة ناقصة عند المنافس ومطلوبة للتجار اللي عندهم أكتر من براند.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),
    passwordHash: text('password_hash'),
    name: text('name').notNull(),
    phone: text('phone'),
    avatar: text('avatar'),
    locale: text('locale').$type<'ar' | 'en'>().notNull().default('ar'),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    isPlatformAdmin: boolean('is_platform_admin').notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
)

/**
 * المتجر = الوحدة الأساسية للعزل. كل صف في كل جدول تاني
 * بيحمل store_id، وكل استعلام لازم يفلتر بيه.
 */
export const stores = pgTable(
  'stores',
  {
    id: uuid('id').primaryKey().defaultRandom(),

    // الهوية
    slug: text('slug').notNull(), // النطاق الفرعي: <slug>.zawya.app
    customDomain: text('custom_domain'),
    customDomainVerifiedAt: timestamp('custom_domain_verified_at', { withTimezone: true }),
    name: text('name').notNull(),
    nameEn: text('name_en'),
    tagline: text('tagline'),
    logoLight: text('logo_light'),
    logoDark: text('logo_dark'),
    favicon: text('favicon'),
    hideNameInHeader: boolean('hide_name_in_header').notNull().default(false),

    // التواصل
    email: text('email'),
    phone: text('phone'),
    whatsapp: text('whatsapp'),

    // الإقليم
    country: text('country').notNull().default('EG'),
    currency: text('currency').notNull().default('EGP'),
    timezone: text('timezone').notNull().default('Africa/Cairo'),
    defaultLocale: text('default_locale').$type<'ar' | 'en'>().notNull().default('ar'),
    enabledLocales: jsonb('enabled_locales').$type<Array<'ar' | 'en'>>().notNull().default(['ar']),

    // الضرائب
    vatEnabled: boolean('vat_enabled').notNull().default(false),
    vatRate: integer('vat_rate').notNull().default(1400), // نقطة أساس: 1400 = 14%
    vatIncludedInPrice: boolean('vat_included_in_price').notNull().default(true),

    // التشغيل
    inventoryEnabled: boolean('inventory_enabled').notNull().default(false),
    bookingsEnabled: boolean('bookings_enabled').notNull().default(false),
    status: text('status').$type<StoreStatus>().notNull().default('trial'),
    trialEndsAt: timestamp('trial_ends_at', { withTimezone: true }),
    subscribedUntil: timestamp('subscribed_until', { withTimezone: true }),
    isPublished: boolean('is_published').notNull().default(false),

    // ترقيم الطلبات لكل متجر على حدة
    orderSequence: integer('order_sequence').notNull().default(1000),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
    deletedAt: deletedAt(),
  },
  (t) => [
    uniqueIndex('stores_slug_unique').on(t.slug),
    uniqueIndex('stores_custom_domain_unique').on(t.customDomain),
    index('stores_status_idx').on(t.status),
  ],
)

/** ربط المستخدمين بالمتاجر — يخدم الفريق وتعدّد المتاجر في آن واحد. */
export const storeMembers = pgTable(
  'store_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').$type<MemberRole>().notNull().default('staff'),
    permissions: jsonb('permissions').$type<string[]>().notNull().default([]),
    invitedBy: uuid('invited_by'),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('store_members_unique').on(t.storeId, t.userId),
    index('store_members_user_idx').on(t.userId),
  ],
)

/** إعدادات الشيك أوت — أهم صفحة تحكّم في المنصة كلها. */
export const checkoutSettings = pgTable('checkout_settings', {
  storeId: uuid('store_id')
    .primaryKey()
    .references(() => stores.id, { onDelete: 'cascade' }),

  // يتكيّف تلقائيًا حسب محتوى السلة (رقمي / مادي / مختلط)
  smartMode: boolean('smart_mode').notNull().default(true),
  addressMode: text('address_mode').$type<AddressMode>().notNull().default('structured'),

  // كل حقل: مطلوب / اختياري / مخفي
  fieldName: text('field_name').$type<FieldMode>().notNull().default('required'),
  fieldPhone: text('field_phone').$type<FieldMode>().notNull().default('required'),
  fieldEmail: text('field_email').$type<FieldMode>().notNull().default('optional'),
  fieldCountry: text('field_country').$type<FieldMode>().notNull().default('required'),
  fieldCity: text('field_city').$type<FieldMode>().notNull().default('required'),
  fieldArea: text('field_area').$type<FieldMode>().notNull().default('optional'),
  fieldStreet: text('field_street').$type<FieldMode>().notNull().default('required'),
  fieldBuilding: text('field_building').$type<FieldMode>().notNull().default('optional'),
  fieldPostalCode: text('field_postal_code').$type<FieldMode>().notNull().default('hidden'),
  fieldNotes: text('field_notes').$type<FieldMode>().notNull().default('optional'),

  showCountryCodePicker: boolean('show_country_code_picker').notNull().default(true),
  showPaymentSelector: boolean('show_payment_selector').notNull().default(true),
  showCouponField: boolean('show_coupon_field').notNull().default(true),
  deliveryMode: text('delivery_mode').$type<'delivery_pickup' | 'delivery' | 'pickup'>().notNull().default('delivery'),

  // الدفع السريع من صفحة المنتج
  quickCheckoutEnabled: boolean('quick_checkout_enabled').notNull().default(true),
  quickCheckoutStyle: text('quick_checkout_style').$type<'inline' | 'drawer'>().notNull().default('drawer'),
  quickCheckoutShowItems: boolean('quick_checkout_show_items').notNull().default(true),

  // الطلب عبر واتساب من صفحة المنتج
  whatsappOrderEnabled: boolean('whatsapp_order_enabled').notNull().default(false),

  // السلة
  cartUpsellEnabled: boolean('cart_upsell_enabled').notNull().default(true),
  minOrderEnabled: boolean('min_order_enabled').notNull().default(false),
  minOrderAmount: integer('min_order_amount').notNull().default(0),

  // التحقق من الطلب
  otpEnabled: boolean('otp_enabled').notNull().default(false),

  /**
   * التقاط الطلب الناقص لحظة ما العميل يكتب رقمه.
   * ده اللي بيحوّل الشيك أوت من نموذج إلى قناة استرداد.
   */
  captureIncompleteOrders: boolean('capture_incomplete_orders').notNull().default(true),

  updatedAt: updatedAt(),
})
