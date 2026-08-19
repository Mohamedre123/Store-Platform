'use server'

import { cookies } from 'next/headers'
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
  productVariants,
  stores,
} from '@/db/schema'
import { getStore, getStoreTheme } from '@/lib/storefront'
import { computeTotals, getCheckoutSettings, priceCart } from '@/lib/checkout'
import { isEmailConfigured, sendEmail } from '@/lib/email'
import { newOrderNotificationEmail, orderConfirmationEmail } from '@/lib/store-emails'
import { dashboardUrl, storeUrl } from '@/lib/domain'
import { validateCoupon, recordCouponUse } from '@/lib/coupons'
import { issueOrderOtp, isPhoneVerifiedForOrder, verifyOrderOtp } from '@/lib/order-otp'
import { computeOfferDiscount, getActiveOffers } from '@/lib/offers'
import { findAffiliateByCode, recordAffiliateConversion } from '@/lib/affiliates'
import { dispatchWebhook } from '@/lib/webhooks'
import { runAutomations } from '@/lib/automation'
import { generateToken } from '@/lib/crypto'
import { normalizePhone } from '@/lib/utils'

export type PlaceOrderState =
  | { ok: true; orderNumber: number; token: string }
  | { ok: false; error: string }
  | null

const lineSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(999),
  variantId: z.string().uuid().optional(),
})

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
  couponCode: z.string().trim().max(32).optional(),
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
  lines: Array<{ productId: string; quantity: number; variantId?: string }>
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
        variantId: l.variantId ?? null,
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
      variantId: l.variantId ?? null,
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

  const phone = normalizePhone(input.phone, store.country === 'EG' ? '20' : '966')

  /**
   * عدد طلبات العميل *قبل* الطلب ده.
   *
   * لازم نقراه قبل المعاملة: بعدها بيبقى العدّاد اتزوّد، وقاعدة زي
   * «رحّب بالعميل الجديد» مش هتشتغل أبدًا لأن العدد بقى ١ مش ٠.
   */
  const [priorCustomer] = await db
    .select({ ordersCount: customers.ordersCount })
    .from(customers)
    .where(and(eq(customers.storeId, store.id), eq(customers.phone, phone)))
    .limit(1)
  const customerOrdersBefore = priorCustomer?.ordersCount ?? 0

  // الكوبون بيتحقّق على الخادم — الخصم بيتحسب هنا مش من المتصفح. لو الكود
  // بقى غير صالح بين ما العميل طبّقه واتأكد، بنكمّل الطلب من غير خصم بدل
  // ما نرفضه ونضيّع البيعة.
  let coupon: { id: string; code: string; discount: number; freeShipping: boolean } | null = null
  if (input.couponCode) {
    const res = await validateCoupon(store.id, input.couponCode, { lines, customerPhone: phone })
    if (res.ok) coupon = { id: res.couponId, code: res.code, discount: res.discount, freeShipping: res.freeShipping }
  }

  // خصم الكمية بيتجمع مع الكوبون — الاتنين مصلحة العميل والتاجر حاططهم بنفسه
  const activeOffers = await getActiveOffers(store.id)
  const offerDiscount = computeOfferDiscount(lines, activeOffers)

  const settings = await getCheckoutSettings(store.id)
  const totals = await computeTotals({
    storeId: store.id,
    lines,
    country: input.country,
    city: input.city ?? null,
    paymentGateway: input.paymentGateway,
    discount: (coupon?.discount ?? 0) + (offerDiscount?.amount ?? 0),
    couponFreeShipping: coupon?.freeShipping ?? false,
  })

  if (settings?.minOrderEnabled && totals.subtotal < settings.minOrderAmount) {
    return { ok: false, error: 'الطلب أقل من الحد الأدنى المسموح' }
  }

  /**
   * التحقق من الرمز — على الخادم لا في المتصفح.
   *
   * لو اعتمدنا على المتصفح إنه «تحقّق»، أي حد يبعت الطلب مباشرة
   * ويتخطّى الخطوة كلها. هنا بنسأل قاعدة البيانات: الرقم ده اتحقّق
   * منه فعلًا خلال آخر نص ساعة ولا لأ.
   */
  if (settings?.otpEnabled) {
    const verified = await isPhoneVerifiedForOrder(store.id, phone)
    if (!verified) {
      return { ok: false, error: 'لازم تتحقق من رقمك الأول' }
    }
  }

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
      couponCode: coupon?.code ?? null,
      couponId: coupon?.id ?? null,
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
        variantId: l.variantId ?? null,
        name: l.name,
        image: l.image,
        price: l.price,
        costPrice: l.costPrice,
        quantity: l.quantity,
        total: l.total,
      })),
    )

    // تسجيل استخدام الكوبون داخل نفس المعاملة — العدّاد والحدود تفضل دقيقة
    if (coupon && (coupon.discount > 0 || coupon.freeShipping)) {
      await recordCouponUse(tx, {
        couponId: coupon.id,
        storeId: store.id,
        orderId: orderId!,
        customerId: customer.id,
        amount: totals.discount,
      })
    }

    /**
     * خصم المخزون مع تسجيل الحركة.
     *
     * لو السطر عليه متغيّر، الخصم بيتم من مخزون المتغيّر — مش من مخزون
     * المنتج. عميل اشترى «أحمر XL» ما ينفعش يقلّل رصيد «أزرق S».
     * عدّاد المبيعات بيتزوّد على المنتج في الحالتين، لأنه بيقيس المنتج
     * كله لا المقاس.
     */
    for (const l of lines) {
      if (l.available === null) continue

      if (l.variantId) {
        await tx
          .update(productVariants)
          .set({ stock: sql`greatest(0, ${productVariants.stock} - ${l.quantity})` })
          .where(
            and(eq(productVariants.id, l.variantId), eq(productVariants.storeId, store.id)),
          )
      } else {
        await tx
          .update(products)
          .set({ stock: sql`greatest(0, ${products.stock} - ${l.quantity})` })
          .where(and(eq(products.id, l.productId), eq(products.storeId, store.id)))
      }

      await tx
        .update(products)
        .set({ soldCount: sql`${products.soldCount} + ${l.quantity}` })
        .where(and(eq(products.id, l.productId), eq(products.storeId, store.id)))

      await tx.insert(inventoryMovements).values({
        storeId: store.id,
        productId: l.productId,
        variantId: l.variantId ?? null,
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

  const token = row?.token ?? ''

  /**
   * تقييد البيعة للمسوّق لو العميل جه من رابطه.
   *
   * العمولة على المنتجات بعد الخصم لا على الإجمالي: الشحن مش ربح
   * للتاجر، والعمولة عليه بتاكل من هامشه. وبتفضل «قيد الانتظار» لحد
   * ما الطلب يتسلّم — الطلب ممكن يتلغي والعمولة على بيعة اتلغت خسارة.
   */
  try {
    const refCode = (await cookies()).get('zw_ref')?.value
    if (refCode) {
      const affiliate = await findAffiliateByCode(store.id, refCode)
      if (affiliate) {
        await recordAffiliateConversion({
          storeId: store.id,
          affiliateId: affiliate.id,
          orderId: result.orderId!,
          eligibleAmount: Math.max(0, totals.subtotal - totals.discount),
          orderTotal: totals.total,
        })
      }
    }
  } catch (e) {
    console.error('فشل تسجيل عمولة المسوّق:', e)
  }

  /**
   * رسائل التأكيد — بعد ما المعاملة نجحت لا جوّاها.
   *
   * لو البريد فشل (مفتاح ناقص، مزوّد واقع)، الطلب لازم يفضل موجود:
   * تاجر معاه طلب من غير إيميل أحسن بكتير من عميل دفع وطلبه اتلغى
   * عشان رسالة ما اتبعتش. عشان كده مفيش await على النتيجة ومفيش throw.
   */
  void sendOrderEmails({
    store,
    orderNumber: result.orderNumber,
    token,
    lines,
    totals,
    input,
    phone,
  }).catch((e) => console.error('فشل إرسال بريد الطلب:', e))

  /**
   * محفّزات الأتمتة — بعد ما الطلب اتسجّل بالكامل.
   *
   * السياق بيتجمّع مرة واحدة وبيتبعت للمحرّك، اللي بيقرّر أي قواعد
   * تنطبق. لو مفيش قواعد، مفيش أي تكلفة تقريبًا.
   */
  const isNewCustomer = customerOrdersBefore === 0
  const autoCtx = {
    storeId: store.id,
    storeName: store.name,
    storeSlug: store.slug,
    currency: store.currency,
    orderId: result.orderId!,
    orderNumber: result.orderNumber,
    orderTotal: totals.total,
    itemCount: lines.reduce((n, l) => n + l.quantity, 0),
    city: input.city ?? undefined,
    paymentMethod: input.paymentGateway === 'cod' ? 'cod' : 'online',
    customerName: input.name ?? null,
    customerEmail: input.email || null,
    customerPhone: phone,
    customerOrders: customerOrdersBefore,
    recoveryToken: token,
  }

  runAutomations('order.created', autoCtx)
  if (isNewCustomer) runAutomations('customer.created', autoCtx)

  // إشعار الأنظمة الخارجية — بدون انتظار، الطلب اتسجّل خلاص
  dispatchWebhook(store.id, 'order.created', {
    orderId: result.orderId,
    orderNumber: result.orderNumber,
    total: totals.total,
    currency: store.currency,
    customerName: input.name ?? null,
    customerPhone: phone,
  })

  return { ok: true, orderNumber: result.orderNumber, token }
}

/** يجمع بيانات الطلب ويبعت رسالتين: تأكيد للعميل وإشعار للتاجر */
async function sendOrderEmails(ctx: {
  store: Awaited<ReturnType<typeof getStore>>
  orderNumber: number
  token: string
  lines: Array<{ name: string; quantity: number; total: number }>
  totals: { subtotal: number; shipping: number; discount: number; total: number }
  input: { email?: string; name?: string; city?: string; area?: string; street?: string; building?: string }
  phone: string
}) {
  const { store, orderNumber, token, lines, totals, input, phone } = ctx
  if (!store || !isEmailConfigured()) return

  const theme = await getStoreTheme(store.id)
  const brandInfo = {
    name: store.name,
    logo: store.logoLight,
    primary: theme.custom.identity.primary,
  }

  const address = [input.street, input.building, input.area, input.city].filter(Boolean).join('، ') || null

  const order = {
    orderNumber,
    customerName: input.name || null,
    lines,
    subtotal: totals.subtotal,
    shipping: totals.shipping,
    discount: totals.discount,
    total: totals.total,
    currency: store.currency,
    address,
    phone,
    trackUrl: `${storeUrl(store.slug)}/order/${orderNumber}?t=${encodeURIComponent(token)}`,
  }

  if (input.email) {
    const mail = orderConfirmationEmail(brandInfo, order)
    await sendEmail({ to: input.email, ...mail })
  }

  // إشعار التاجر — على بريد المتجر لو موجود
  if (store.email) {
    const mail = newOrderNotificationEmail(brandInfo, order, `${dashboardUrl()}/orders`)
    await sendEmail({ to: store.email, ...mail })
  }
}

/**
 * تطبيق كوبون من الشيك أوت — لعرض الخصم للعميل قبل ما يأكّد.
 *
 * السلطة النهائية على الخصم في placeOrderAction (بيتحقّق تاني)، لكن ده
 * بيدّي العميل رد فعل فوري: الكود اتقبل وخصمك كذا، أو الكود غلط وليه.
 */
export async function applyCouponAction(input: {
  storeIdentifier: string
  code: string
  phone?: string
  lines: Array<{ productId: string; quantity: number; variantId?: string }>
}): Promise<{ ok: true; discount: number; freeShipping: boolean; code: string } | { ok: false; error: string }> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  const { lines, issue } = await priceCart(store.id, input.lines)
  if (issue) return { ok: false, error: 'السلة فاضية' }

  const phone = input.phone ? normalizePhone(input.phone, store.country === 'EG' ? '20' : '966') : null
  const res = await validateCoupon(store.id, input.code, { lines, customerPhone: phone })
  if (!res.ok) return { ok: false, error: res.message }

  return { ok: true, discount: res.discount, freeShipping: res.freeShipping, code: res.code }
}

/* ────────────────────────── رمز التحقق ────────────────────────── */

/** يبعت رمز تحقق للعميل قبل تأكيد الطلب */
export async function requestOrderOtpAction(input: {
  storeIdentifier: string
  phone: string
  email?: string
}): Promise<{ ok: true; target: string } | { ok: false; error: string }> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  const phone = normalizePhone(input.phone, store.country === 'EG' ? '20' : '966')
  const res = await issueOrderOtp({
    storeId: store.id,
    storeName: store.name,
    phone,
    email: input.email,
  })

  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, target: res.maskedTarget }
}

/** يتحقق من الرمز — الطلب نفسه بيتحقق تاني قبل ما يتسجّل */
export async function verifyOrderOtpAction(input: {
  storeIdentifier: string
  phone: string
  code: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  const phone = normalizePhone(input.phone, store.country === 'EG' ? '20' : '966')
  return verifyOrderOtp(store.id, phone, input.code)
}
