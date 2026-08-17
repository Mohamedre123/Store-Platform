import { pgTable, uuid, text, boolean, integer, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core'
import { stores } from './tenancy'
import { customers } from './customers'
import { createdAt, updatedAt, money, moneyNullable } from './_shared'

export type OrderStatus =
  | 'incomplete' // طلب ناقص — العميل كتب رقمه ومكمّلش
  | 'pending'    // اتسجّل ومستني تأكيد
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'returned'

export type PaymentStatus = 'unpaid' | 'pending' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'
export type OrderSource = 'storefront' | 'quick_checkout' | 'funnel' | 'whatsapp' | 'manual' | 'api' | 'marketplace'

export type ShippingAddress = {
  name?: string
  phone?: string
  country?: string
  city?: string
  area?: string
  street?: string
  building?: string
  postalCode?: string
  notes?: string
}

export const orders = pgTable(
  'orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    orderNumber: integer('order_number').notNull(),
    customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),

    status: text('status').$type<OrderStatus>().notNull().default('pending'),
    paymentStatus: text('payment_status').$type<PaymentStatus>().notNull().default('unpaid'),

    // بيانات العميل مخزَّنة على الطلب نفسه — الطلب سجل تاريخي
    // ما ينفعش يتغيّر لو العميل عدّل بياناته بعدين
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    customerEmail: text('customer_email'),
    shippingAddress: jsonb('shipping_address').$type<ShippingAddress>(),

    // المبالغ — بالوحدة الصغرى
    subtotal: money('subtotal'),
    discountTotal: money('discount_total'),
    shippingTotal: money('shipping_total'),
    taxTotal: money('tax_total'),
    codFee: money('cod_fee'),
    gatewayFee: money('gateway_fee'),
    total: money('total'),
    /** تكلفة البضاعة وقت البيع — أساس حساب الربح الحقيقي */
    costTotal: money('cost_total'),
    currency: text('currency').notNull().default('EGP'),

    couponCode: text('coupon_code'),
    couponId: uuid('coupon_id'),

    paymentMethod: text('payment_method'), // cod | online | manual_transfer
    paymentGateway: text('payment_gateway'), // paymob | fawry | ...
    paymentReference: text('payment_reference'),
    paidAt: timestamp('paid_at', { withTimezone: true }),

    shippingMethod: text('shipping_method'), // delivery | pickup
    shippingCarrier: text('shipping_carrier'),
    trackingNumber: text('tracking_number'),

    notes: text('notes'),          // ملاحظة العميل
    internalNote: text('internal_note'), // ملاحظة التاجر

    source: text('source').$type<OrderSource>().notNull().default('storefront'),
    funnelId: uuid('funnel_id'),
    affiliateId: uuid('affiliate_id'),
    utm: jsonb('utm').$type<Record<string, string>>(),
    /** معرّف موحّد يُرسل للبكسل من المتصفح ومن السيرفر لمنع ازدواج الأحداث */
    eventId: text('event_id'),

    // استرداد السلات المتروكة
    isIncomplete: boolean('is_incomplete').notNull().default(false),
    abandonedAt: timestamp('abandoned_at', { withTimezone: true }),
    remindersSent: integer('reminders_sent').notNull().default(0),
    lastReminderAt: timestamp('last_reminder_at', { withTimezone: true }),
    recoveredAt: timestamp('recovered_at', { withTimezone: true }),
    recoveryToken: text('recovery_token'),

    // التحقق بالرمز
    otpVerifiedAt: timestamp('otp_verified_at', { withTimezone: true }),

    // نقاط الولاء المكتسبة من هذا الطلب
    pointsEarned: integer('points_earned').notNull().default(0),
    pointsRedeemed: integer('points_redeemed').notNull().default(0),

    cancelReason: text('cancel_reason'),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('orders_store_number_unique').on(t.storeId, t.orderNumber),
    index('orders_store_status_idx').on(t.storeId, t.status),
    index('orders_store_created_idx').on(t.storeId, t.createdAt),
    index('orders_customer_idx').on(t.customerId),
    index('orders_phone_idx').on(t.storeId, t.customerPhone),
    index('orders_incomplete_idx').on(t.storeId, t.isIncomplete),
    index('orders_recovery_token_idx').on(t.recoveryToken),
  ],
)

export const orderItems = pgTable(
  'order_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    productId: uuid('product_id'),
    variantId: uuid('variant_id'),

    // لقطة من المنتج وقت الشراء — لو التاجر غيّر الاسم أو السعر بعدين
    // الطلب القديم يفضل صحيح
    name: text('name').notNull(),
    variantTitle: text('variant_title'),
    sku: text('sku'),
    image: text('image'),
    price: money('price'),
    costPrice: moneyNullable('cost_price'),
    quantity: integer('quantity').notNull().default(1),
    total: money('total'),
    options: jsonb('options').$type<Array<{ name: string; value: string }>>().notNull().default([]),
    /** بند مجاني ناتج عن عرض أو مكافأة */
    isGift: boolean('is_gift').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('order_items_order_idx').on(t.orderId),
    index('order_items_product_idx').on(t.productId),
  ],
)

/** المسار الزمني للطلب — كل تغيير يُسجَّل */
export const orderEvents = pgTable(
  'order_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    type: text('type').notNull(), // created | status_changed | payment | shipment | message_sent | note
    message: text('message').notNull(),
    meta: jsonb('meta').$type<Record<string, unknown>>(),
    actorType: text('actor_type').$type<'system' | 'merchant' | 'customer' | 'carrier' | 'gateway'>().notNull().default('system'),
    actorId: uuid('actor_id'),
    createdAt: createdAt(),
  },
  (t) => [index('order_events_order_idx').on(t.orderId, t.createdAt)],
)

/** المرتجعات والاستبدال — وجع يومي في سوق الدفع عند الاستلام، وغير موجود عند المنافس */
export const returns = pgTable(
  'returns',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id').notNull().references(() => orders.id, { onDelete: 'cascade' }),
    returnNumber: integer('return_number').notNull(),
    type: text('type').$type<'refund' | 'exchange'>().notNull().default('refund'),
    status: text('status').$type<'requested' | 'approved' | 'rejected' | 'picked_up' | 'received' | 'completed'>().notNull().default('requested'),
    reason: text('reason'),
    customerNote: text('customer_note'),
    merchantNote: text('merchant_note'),
    refundAmount: money('refund_amount'),
    restockItems: boolean('restock_items').notNull().default(true),
    images: jsonb('images').$type<string[]>().notNull().default([]),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('returns_store_number_unique').on(t.storeId, t.returnNumber),
    index('returns_order_idx').on(t.orderId),
  ],
)

export const returnItems = pgTable(
  'return_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    returnId: uuid('return_id').notNull().references(() => returns.id, { onDelete: 'cascade' }),
    orderItemId: uuid('order_item_id').notNull(),
    quantity: integer('quantity').notNull().default(1),
    amount: money('amount'),
  },
  (t) => [index('return_items_return_idx').on(t.returnId)],
)

/** الحجوزات والمواعيد */
export const bookings = pgTable(
  'bookings',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    storeId: uuid('store_id').notNull().references(() => stores.id, { onDelete: 'cascade' }),
    orderId: uuid('order_id').references(() => orders.id, { onDelete: 'cascade' }),
    productId: uuid('product_id').notNull(),
    customerId: uuid('customer_id'),
    customerName: text('customer_name'),
    customerPhone: text('customer_phone'),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: text('status').$type<'pending' | 'confirmed' | 'completed' | 'cancelled' | 'no_show'>().notNull().default('pending'),
    notes: text('notes'),
    createdAt: createdAt(),
  },
  (t) => [
    index('bookings_store_time_idx').on(t.storeId, t.startsAt),
    index('bookings_product_idx').on(t.productId, t.startsAt),
  ],
)
