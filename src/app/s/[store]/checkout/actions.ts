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
import {
  newOrderNotificationEmail,
  orderConfirmationEmail,
  orderInvoiceEmail,
} from '@/lib/store-emails'
import { dashboardUrl, storeUrl } from '@/lib/domain'
import { validateCoupon, recordCouponUse } from '@/lib/coupons'
import { issueOrderOtp, isPhoneVerifiedForOrder, verifyOrderOtp } from '@/lib/order-otp'
import { computeOfferDiscount, getActiveOffers } from '@/lib/offers'
import { findAffiliateByCode, recordAffiliateConversion } from '@/lib/affiliates'
import { dispatchWebhook } from '@/lib/webhooks'
import { runAutomations } from '@/lib/automation'
import { recordReferral } from '@/lib/referrals'
import { trackExperimentConversions } from '@/lib/experiments'
import { generateToken } from '@/lib/crypto'
import { normalizePhone } from '@/lib/utils'
import { getCurrentCustomer } from '@/lib/customer-auth'
import { startPayment } from '@/lib/payment-dispatch'
import { consumeFromDefaultBranch } from '@/lib/branches'
import { notifyTeam } from '@/lib/notify-team'
import { createBooking } from '@/lib/bookings'
import { paymentProvider } from '@/lib/providers'

/**
 * معرّف الزائر من الكوكي.
 *
 * بيستخدم في تجارب السعر بس. لو مش موجود (كوكيز مقفولة، أول طلب
 * قبل ما الوكيل يحطه) التسعير بيرجع للسعر الأساسي — مفيش تجربة
 * أحسن من سعر عشوائي.
 */
async function visitorId(): Promise<string | null> {
  return (await cookies()).get('zw_v')?.value ?? null
}

export type PlaceOrderState =
  | {
      ok: true
      orderNumber: number
      token: string
      /** رابط صفحة الدفع — المتصفح بيتحوّل عليه فورًا لما يكون موجود */
      redirectUrl?: string
      /**
       * البوابة رفضت تعمل جلسة دفع.
       *
       * الطلب اتسجّل برضه — بنوصّل العميل لصفحة الطلب ومعاه الرسالة
       * وزرار «ادفع دلوقتي». إلغاء الطلب هنا كان بيضيّع بيعة عشان
       * عطل مؤقّت عند طرف تالت.
       */
      paymentError?: string
    }
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
  /**
   * مواعيد الخدمات: معرّف المنتج → وقت البداية بصيغة ISO.
   *
   * جاي من المتصفح، فبيتحقّق منه على الخادم قبل التسجيل — الوقت
   * اللي بعت من غير فحص ممكن يبقى اتحجز في اللحظة اللي بين اختياره
   * وإرساله.
   */
  slots: z.record(z.string().uuid(), z.string()).optional(),
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

  const { lines } = await priceCart(store.id, input.lines, await visitorId())
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

  /**
   * الطلب لازم يكون ليه صاحب مسجّل.
   *
   * **الفحص هنا لا في الصفحة بس.** الصفحة بتوجّه للدخول، لكن الفعل
   * ده ممكن يتنادى مباشرةً — وإخفاء الزرار مش حماية. من غير الفحص
   * ده حد يقدر يعمل طلبات باسم أرقام مش بتاعته.
   */
  const account = await getCurrentCustomer(store.id)
  if (!account) {
    return { ok: false, error: 'لازم تسجّل دخول الأول عشان طلبك يتحفظ في حسابك' }
  }

  const { lines, issue } = await priceCart(store.id, input.lines, await visitorId())
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
    /*
      الطلب بيتقيّد على **الحساب اللي داخل**، لا على الرقم المكتوب.

      لو قيّدناه على الرقم، حد يكتب رقم غيره ويربط الطلب بحسابه —
      والعميل التاني يلاقي في حسابه طلبًا ما عملهوش. والبيانات
      المكتوبة بتتحدّث على نفس الحساب عشان التاجر يشوف آخر عنوان
      وتليفون.
    */
    await tx
      .update(customers)
      .set({
        name: input.name || undefined,
        phone: phone || undefined,
        email: input.email || undefined,
        lastOrderAt: new Date(),
      })
      .where(and(eq(customers.id, account.id), eq(customers.storeId, store.id)))

    const customer = { id: account.id }

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

    return {
      orderId,
      orderNumber,
      customerId: customer.id,
      token: values.recoveredAt ? input.draftToken! : '',
    }
  })

  const [row] = await db
    .select({ token: orders.recoveryToken })
    .from(orders)
    .where(eq(orders.id, result.orderId!))
    .limit(1)

  const token = row?.token ?? ''

  /**
   * تسجيل مواعيد الخدمات.
   *
   * بعد الطلب لا قبله: الحجز بيشاور على طلب، والطلب لازم يكون
   * موجود. ولو معاد اتحجز في اللحظة الأخيرة، بنسجّل السبب على
   * الطلب — **وما بنلغيش الطلب**: العميل دفع، والتاجر هو اللي
   * بيكلّمه ويتفقوا على معاد تاني.
   */
  if (input.slots && Object.keys(input.slots).length > 0) {
    void (async () => {
      for (const [productId, startsAt] of Object.entries(input.slots ?? {})) {
        // الخدمة لازم تكون في الطلب فعلًا — مش أي معرّف بيتبعت
        if (!lines.some((l) => l.productId === productId)) continue

        const res = await createBooking({
          storeId: store.id,
          orderId: result.orderId!,
          productId,
          customerId: result.customerId,
          customerName: input.name ?? null,
          customerPhone: phone,
          startsAt,
          notes: input.notes ?? null,
        })

        if (!res.ok) {
          await db.insert(orderEvents).values({
            orderId: result.orderId!,
            storeId: store.id,
            type: 'note',
            message: `ما اتسجّلش معاد للخدمة: ${res.error}. كلّم العميل واتفقوا على معاد.`,
            actorType: 'system',
          })
        }
      }
    })().catch((e) => console.error('فشل تسجيل الحجز:', e))
  }

  /*
    خصم البيع من توزيع الفروع.

    بعد المعاملة وبغير await: التوزيع بيانات إدارية بتقول «البضاعة
    فين»، والخصم الحقيقي اتعمل جوّه المعاملة على `products.stock`.
    طلب بيقع عشان صف مفقود في جدول توزيع خسارة حقيقية مقابل رقم
    تقريبي.
  */
  void consumeFromDefaultBranch(
    store.id,
    lines.map((l) => ({
      productId: l.productId,
      variantId: l.variantId ?? null,
      quantity: l.quantity,
    })),
  ).catch((e) => console.error('فشل خصم مخزون الفرع:', e))

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
   * إحالة صاحب.
   *
   * للعميل الجديد بس — لو حسبناها على أي طلب، عميل قديم يستخدم كود
   * صاحبه في كل طلب والاتنين ياخدوا نقاط بلا نهاية. والنقاط نفسها
   * بتتصرف وقت التسليم زي نقاط الشراء.
   */
  try {
    const rfCode = (await cookies()).get('zw_rf')?.value
    if (rfCode) {
      await recordReferral({
        storeId: store.id,
        code: rfCode,
        referredCustomerId: result.customerId,
        previousOrders: customerOrdersBefore,
        orderId: result.orderId!,
      })
    }
  } catch (e) {
    console.error('فشل تسجيل الإحالة:', e)
  }

  /*
    تقييد تحويلات تجارب السعر. بعد نجاح الطلب لا قبله — التجربة
    بتقيس البيعات اللي تمّت فعلًا.
  */
  try {
    await trackExperimentConversions(
      store.id,
      await visitorId(),
      lines.map((l) => ({ productId: l.productId, total: l.total })),
    )
  } catch (e) {
    console.error('فشل تسجيل تحويل التجربة:', e)
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
    orderId: result.orderId!,
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

  /*
    إشعار الفريق قبل قواعد الأتمتة: ده اللي بيخلّي اللي بيغلّف يعرف
    إن فيه طلب وهو في المخزن. القواعد ممكن تكون فاضية، والإشعار ده
    بيشتغل من غير أي إعداد غير إن التاجر يضيف نفسه.
  */
  notifyTeam('order_placed', {
    storeId: store.id,
    storeName: store.name,
    orderId: result.orderId!,
    orderNumber: result.orderNumber,
    total: totals.total,
    currency: store.currency,
    customerName: input.name ?? null,
    customerPhone: phone,
    city: input.city ?? null,
  })

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

  /**
   * جلسة الدفع — بعد ما الطلب اتسجّل بالكامل.
   *
   * الترتيب ده مقصود: الطلب موجود عند التاجر أول بأول، ولو البوابة
   * وقعت التاجر بيشوف الطلب ويكلّم العميل. العكس كان بيخلّي الطلب
   * يختفي كأن محدش حاول.
   */
  if (paymentProvider(input.paymentGateway)) {
    const session = await startPayment(store.id, result.orderId!)
    if (session.ok) {
      return { ok: true, orderNumber: result.orderNumber, token, redirectUrl: session.redirectUrl }
    }
    return { ok: true, orderNumber: result.orderNumber, token, paymentError: session.error }
  }

  return { ok: true, orderNumber: result.orderNumber, token }
}

/**
 * إعادة محاولة الدفع من صفحة الطلب.
 *
 * العميل اللي قفل صفحة البوابة أو فشل دفعه لازم يلاقي طريقًا يرجع
 * بيه — من غيره بيكلّم التاجر على واتساب، والتاجر بيلغي الطلب.
 *
 * الرمز في الرابط هو الإذن: من غيره أي حد يقدر يفتح جلسة دفع على
 * طلب مش بتاعه ويشوف بياناته.
 */
export async function retryPaymentAction(input: {
  storeIdentifier: string
  orderNumber: number
  token: string
}): Promise<{ ok: true; redirectUrl: string } | { ok: false; error: string }> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  const [order] = await db
    .select({ id: orders.id, token: orders.recoveryToken })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.orderNumber, input.orderNumber)))
    .limit(1)

  if (!order || !order.token || order.token !== input.token) {
    return { ok: false, error: 'الرابط مش صحيح' }
  }

  const res = await startPayment(store.id, order.id)
  if (!res.ok) return { ok: false, error: res.error }
  return { ok: true, redirectUrl: res.redirectUrl }
}

/**
 * اسم طريقة الدفع زي ما العميل بيعرفها.
 *
 * الفاتورة اللي مكتوب فيها `cod` أو `paymob` مش فاتورة — دي شفرة
 * داخلية. العميل لازم يقرا «الدفع عند الاستلام».
 */
function paymentLabel(gateway: string): string {
  if (gateway === 'cod') return 'الدفع عند الاستلام'
  if (gateway === 'manual') return 'تحويل بنكي أو محفظة'
  return paymentProvider(gateway)?.name ?? gateway
}

/** يجمع بيانات الطلب ويبعت رسالتين: تأكيد للعميل وإشعار للتاجر */
async function sendOrderEmails(ctx: {
  store: Awaited<ReturnType<typeof getStore>>
  orderId: string
  orderNumber: number
  token: string
  lines: Array<{ name: string; quantity: number; total: number }>
  totals: {
    subtotal: number
    shipping: number
    discount: number
    total: number
    codFee: number
    tax: number
  }
  input: {
    email?: string
    name?: string
    city?: string
    area?: string
    street?: string
    building?: string
    paymentGateway: string
  }
  phone: string
}) {
  const { store, orderId, orderNumber, token, lines, totals, input, phone } = ctx
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
    codFee: totals.codFee,
    tax: totals.tax,
    paymentLabel: paymentLabel(input.paymentGateway),
    placedAt: new Date(),
    trackUrl: `${storeUrl(store.slug)}/order/${orderNumber}?t=${encodeURIComponent(token)}`,
  }

  if (input.email) {
    /**
     * الفاتورة بتتبعت مع التأكيد.
     *
     * رسالتين لا واحدة: التأكيد بيطمّن العميل إن الطلب وصل (بيتقرا
     * في ثانية)، والفاتورة ورقة رسمية بيحتفظ بيها ويرجعلها. دمجهم
     * في رسالة واحدة بيخلّي التأكيد طويلًا والفاتورة صعبة اللقيان.
     *
     * والفاتورة بتتبعت بغير انتظار: الطلب اتسجّل خلاص، ورسالة
     * فشلت ما يصحّش تأخّر رد الشيك أوت.
     */
    void sendEmail({
      to: input.email,
      ...orderInvoiceEmail(brandInfo, order),
      replyTo: store.email ?? undefined,
      senderName: store.name,
      log: { storeId: store.id, event: 'order_invoice', orderId },
    }).catch((e) => console.error('فشل إرسال الفاتورة:', e))

    const mail = orderConfirmationEmail(brandInfo, order)
    await sendEmail({
      to: input.email,
      ...mail,
      /*
        الرد على بريد التاجر لا على عنوان لا يُرد عليه.
        العميل اللي عايز يغيّر عنوانه بيرد على الرسالة — والرسالة
        اللي مالهاش رد بتبان لفلاتر السبام كإشعار آلي مجهول.
      */
      replyTo: store.email ?? undefined,
      senderName: store.name,
      log: { storeId: store.id, event: 'order_confirmation', orderId },
    })
  }

  // إشعار التاجر — على بريد المتجر لو موجود
  if (store.email) {
    const mail = newOrderNotificationEmail(brandInfo, order, `${dashboardUrl()}/orders`)
    await sendEmail({
      to: store.email,
      ...mail,
      senderName: store.name,
      log: { storeId: store.id, event: 'merchant_new_order', orderId },
    })
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

  const { lines, issue } = await priceCart(store.id, input.lines, await visitorId())
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
