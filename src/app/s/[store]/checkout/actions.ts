'use server'

import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import {
  customers,
  inventoryMovements,
  orderEvents,
  orderItems,
  orders,
  products,
  stores,
} from '@/db/schema'
import { getStore } from '@/lib/storefront'
import { computeTotals, getCheckoutSettings, priceCart } from '@/lib/checkout'
import { generateToken } from '@/lib/crypto'
import { normalizePhone } from '@/lib/utils'

export type PlaceOrderState =
  | { ok: true; orderNumber: number; token: string }
  | { ok: false; error: string }
  | null

const lineSchema = z.object({ productId: z.string().uuid(), quantity: z.number().int().min(1).max(999) })

const orderSchema = z.object({
  storeIdentifier: z.string().min(1),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(6, 'اكتب رقم تليفون صحيح'),
  email: z.string().trim().email('البريد غير صحيح').optional().or(z.literal('')),
  country: z.string().trim().default('EG'),
  city: z.string().trim().optional(),
  area: z.string().trim().optional(),
  street: z.string().trim().optional(),
  building: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
  paymentGateway: z.string().trim().default('cod'),
  lines: z.array(lineSchema).min(1, 'السلة فاضية'),
  /** يربط الطلب المكتمل بالسجل الناقص اللي اتحفظ وهو بيكتب */
  draftToken: z.string().optional(),
})

/**
 * التقاط الطلب الناقص.
 *
 * بيتنادى وهو لسه بيكتب — أول ما يكتب رقم تليفون صالح. بيحفظ الطلب
 * بحالة «ناقص» فيظهر للتاجر في لوحته حتى لو العميل قفل الصفحة ومكمّلش.
 *
 * ده الفرق بين إن التاجر يشوف طلبًا ضائعًا ويكلّم صاحبه، وبين إنه
 * ما يعرفش أصلًا إن حد كان قرّب يشتري.
 */
export async function captureIncompleteOrder(input: {
  storeIdentifier: string
  phone: string
  name?: string
  city?: string
  lines: Array<{ productId: string; quantity: number }>
  draftToken?: string
}): Promise<{ token: string } | null> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return null

  const settings = await getCheckoutSettings(store.id)
  if (settings && !settings.captureIncompleteOrders) return null

  const phone = normalizePhone(input.phone, store.country === 'EG' ? '20' : '966')
  if (phone.replace(/\D/g, '').length < 10) return null

  const { lines } = await priceCart(store.id, input.lines)
  if (lines.length === 0) return null

  const totals = await computeTotals({
    storeId: store.id,
    lines,
    country: store.country,
    city: input.city ?? null,
    paymentGateway: null,
  })

  const token = input.draftToken || generateToken(16)

  const [existing] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.recoveryToken, token)))
    .limit(1)

  const shared = {
    customerName: input.name || null,
    customerPhone: phone,
    shippingAddress: { city: input.city, country: store.country },
    subtotal: totals.subtotal,
    shippingTotal: totals.shipping,
    total: totals.total,
    costTotal: totals.costTotal,
    abandonedAt: new Date(),
  }

  if (existing) {
    await db.update(orders).set(shared).where(eq(orders.id, existing.id))
    await db.delete(orderItems).where(eq(orderItems.orderId, existing.id))
    await db.insert(orderItems).values(
      lines.map((l) => ({
        orderId: existing.id,
        storeId: store.id,
        productId: l.productId,
        name: l.name,
        image: l.image,
        price: l.price,
        costPrice: l.costPrice,
        quantity: l.quantity,
        total: l.total,
      })),
    )
    return { token }
  }

  // رقم الطلب الناقص محجوز من نفس التسلسل، فلو اكتمل ما يتغيّرش رقمه
  const [store2] = await db
    .update(stores)
    .set({ orderSequence: sql`${stores.orderSequence} + 1` })
    .where(eq(stores.id, store.id))
    .returning({ orderSequence: stores.orderSequence })

  const [created] = await db
    .insert(orders)
    .values({
      ...shared,
      storeId: store.id,
      orderNumber: store2.orderSequence,
      status: 'incomplete',
      isIncomplete: true,
      currency: store.currency,
      recoveryToken: token,
      source: 'storefront',
    })
    .returning({ id: orders.id })

  await db.insert(orderItems).values(
    lines.map((l) => ({
      orderId: created.id,
      storeId: store.id,
      productId: l.productId,
      name: l.name,
      image: l.image,
      price: l.price,
      costPrice: l.costPrice,
      quantity: l.quantity,
      total: l.total,
    })),
  )

  return { token }
}

/* ────────────────────────── إنشاء الطلب ────────────────────────── */

export async function placeOrderAction(raw: unknown): Promise<PlaceOrderState> {
  const parsed = orderSchema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'فيه بيانات ناقصة' }
  }
  const input = parsed.data

  const store = await getStore(input.storeIdentifier)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }
  if (!store.isPublished) return { ok: false, error: 'المتجر مش متاح للطلب دلوقتي' }

  const { lines, issue } = await priceCart(store.id, input.lines)
  if (issue) {
    const messages = {
      empty: 'السلة فاضية',
      unavailable: 'فيه منتجات ما بقتش متاحة',
      out_of_stock: 'فيه منتجات نفدت كميتها',
      below_minimum: 'الطلب أقل من الحد الأدنى',
    } as const
    return { ok: false, error: messages[issue.kind] }
  }

  const settings = await getCheckoutSettings(store.id)
  const totals = await computeTotals({
    storeId: store.id,
    lines,
    country: input.country,
    city: input.city ?? null,
    paymentGateway: input.paymentGateway,
  })

  if (settings?.minOrderEnabled && totals.subtotal < settings.minOrderAmount) {
    return { ok: false, error: 'الطلب أقل من الحد الأدنى المسموح' }
  }

  const phone = normalizePhone(input.phone, store.country === 'EG' ? '20' : '966')

  const result = await db.transaction(async (tx) => {
    // عميل واحد لكل رقم في كل متجر
    const [customer] = await tx
      .insert(customers)
      .values({ storeId: store.id, name: input.name || null, phone, email: input.email || null })
      .onConflictDoUpdate({
        target: [customers.storeId, customers.phone],
        set: { name: input.name || null, lastOrderAt: new Date() },
      })
      .returning({ id: customers.id })

    /**
     * لو العميل كان بيكتب واتحفظله طلب ناقص، بنكمّله بدل ما ننشئ
     * طلبًا جديدًا — وإلا يبقى عند التاجر طلبان لنفس الشخص.
     */
    let orderId: string | null = null
    let orderNumber = 0

    if (input.draftToken) {
      const [draft] = await tx
        .select({ id: orders.id, orderNumber: orders.orderNumber })
        .from(orders)
        .where(
          and(
            eq(orders.storeId, store.id),
            eq(orders.recoveryToken, input.draftToken),
            eq(orders.isIncomplete, true),
          ),
        )
        .limit(1)

      if (draft) {
        orderId = draft.id
        orderNumber = draft.orderNumber
        await tx.delete(orderItems).where(eq(orderItems.orderId, draft.id))
      }
    }

    if (!orderId) {
      const [seq] = await tx
        .update(stores)
        .set({ orderSequence: sql`${stores.orderSequence} + 1` })
        .where(eq(stores.id, store.id))
        .returning({ orderSequence: stores.orderSequence })
      orderNumber = seq.orderSequence
    }

    const values = {
      customerId: customer.id,
      customerName: input.name || null,
      customerPhone: phone,
      customerEmail: input.email || null,
      shippingAddress: {
        name: input.name,
        phone,
        country: input.country,
        city: input.city,
        area: input.area,
        street: input.street,
        building: input.building,
        notes: input.notes,
      },
      subtotal: totals.subtotal,
      shippingTotal: totals.shipping,
      codFee: totals.codFee,
      taxTotal: totals.tax,
      discountTotal: totals.discount,
      total: totals.total,
      costTotal: totals.costTotal,
      currency: store.currency,
      paymentMethod: input.paymentGateway === 'cod' ? 'cod' : 'online',
      paymentGateway: input.paymentGateway,
      paymentStatus: 'unpaid' as const,
      status: 'pending' as const,
      isIncomplete: false,
      notes: input.notes || null,
      shippingMethod: 'delivery',
      recoveredAt: input.draftToken ? new Date() : null,
      confirmedAt: null,
    }

    if (orderId) {
      await tx.update(orders).set(values).where(eq(orders.id, orderId))
    } else {
      const [created] = await tx
        .insert(orders)
        .values({
          ...values,
          storeId: store.id,
          orderNumber,
          recoveryToken: input.draftToken || generateToken(16),
          source: 'storefront',
        })
        .returning({ id: orders.id })
      orderId = created.id
    }

    await tx.insert(orderItems).values(
      lines.map((l) => ({
        orderId: orderId!,
        storeId: store.id,
        productId: l.productId,
        name: l.name,
        image: l.image,
        price: l.price,
        costPrice: l.costPrice,
        quantity: l.quantity,
        total: l.total,
      })),
    )

    // خصم المخزون مع تسجيل الحركة
    for (const l of lines) {
      if (l.available === null) continue
      await tx
        .update(products)
        .set({ stock: sql`greatest(0, ${products.stock} - ${l.quantity})`, soldCount: sql`${products.soldCount} + ${l.quantity}` })
        .where(and(eq(products.id, l.productId), eq(products.storeId, store.id)))

      await tx.insert(inventoryMovements).values({
        storeId: store.id,
        productId: l.productId,
        delta: -l.quantity,
        reason: 'order',
        referenceId: orderId,
        note: `طلب رقم ${orderNumber}`,
      })
    }

    await tx
      .update(customers)
      .set({
        ordersCount: sql`${customers.ordersCount} + 1`,
        totalSpent: sql`${customers.totalSpent} + ${totals.total}`,
        lastOrderAt: new Date(),
      })
      .where(eq(customers.id, customer.id))

    await tx.insert(orderEvents).values({
      orderId,
      storeId: store.id,
      type: 'created',
      message: input.draftToken ? 'اكتمل الطلب بعد ما كان ناقصًا' : 'تم استلام الطلب',
      actorType: 'customer',
    })

    return { orderId, orderNumber, token: values.recoveredAt ? input.draftToken! : '' }
  })

  const [row] = await db
    .select({ token: orders.recoveryToken })
    .from(orders)
    .where(eq(orders.id, result.orderId!))
    .limit(1)

  return { ok: true, orderNumber: result.orderNumber, token: row?.token ?? '' }
}
