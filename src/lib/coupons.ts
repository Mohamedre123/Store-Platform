import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { coupons, couponUses, customers, orders, products } from '@/db/schema'
import { applyBps } from './utils'
import type { PricedLine } from './checkout'

/**
 * التحقق من الكوبون وحساب خصمه — على الخادم فقط.
 *
 * القاعدة زي التسعير: الخصم بيتحسب هنا من قاعدة البيانات، مش من المتصفح.
 * لو اعتمدنا على رقم جاي من العميل، أي حد يكتب خصمًا لنفسه. الدالة دي
 * بتترجع الخصم بالوحدة الصغرى، وبتتنادى مرتين: وقت ما العميل يطبّق الكود
 * (لعرض الأثر) ومرة تانية وقت تأكيد الطلب (السلطة النهائية).
 */

export type CouponResult =
  | { ok: true; couponId: string; code: string; discount: number; freeShipping: boolean; message: string }
  | { ok: false; message: string }

export async function validateCoupon(
  storeId: string,
  rawCode: string,
  ctx: { lines: PricedLine[]; customerPhone?: string | null },
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase()
  if (!code) return { ok: false, message: 'اكتب كود الخصم' }

  const [coupon] = await db
    .select()
    .from(coupons)
    .where(and(eq(coupons.storeId, storeId), sql`upper(${coupons.code}) = ${code}`))
    .limit(1)

  if (!coupon || !coupon.isActive) return { ok: false, message: 'الكود ده مش صحيح' }

  const now = new Date()
  if (coupon.startsAt && now < coupon.startsAt) return { ok: false, message: 'الكود لسه ما اشتغلش' }
  if (coupon.endsAt && now > coupon.endsAt) return { ok: false, message: 'الكود ده انتهت صلاحيته' }

  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, message: 'الكود ده خلص عدد استخداماته' }
  }

  const subtotal = ctx.lines.reduce((n, l) => n + l.total, 0)
  if (coupon.minOrder && subtotal < coupon.minOrder) {
    return { ok: false, message: `الكود ده للطلبات فوق ${(coupon.minOrder / 100).toLocaleString('ar-EG')} ج.م` }
  }

  // العميل صاحب الكود — للتحقق من «أول طلب» والحد لكل عميل
  let customerId: string | null = null
  let customerOrders = 0
  if (ctx.customerPhone) {
    const [c] = await db
      .select({ id: customers.id, ordersCount: customers.ordersCount })
      .from(customers)
      .where(and(eq(customers.storeId, storeId), eq(customers.phone, ctx.customerPhone)))
      .limit(1)
    if (c) {
      customerId = c.id
      customerOrders = c.ordersCount
    }
  }

  if (coupon.eligibility === 'first_order' && customerOrders > 0) {
    return { ok: false, message: 'الكود ده لأول طلب بس' }
  }

  if (customerId && coupon.usageLimitPerCustomer > 0) {
    const [used] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(couponUses)
      .where(and(eq(couponUses.couponId, coupon.id), eq(couponUses.customerId, customerId)))
    if ((used?.n ?? 0) >= coupon.usageLimitPerCustomer) {
      return { ok: false, message: 'استخدمت الكود ده قبل كده' }
    }
  }

  // المبلغ اللي ينطبق عليه الخصم — كله أو منتجات/أقسام محددة
  let eligible = subtotal
  if (coupon.appliesTo !== 'all' && coupon.targetIds.length) {
    let productIds = coupon.targetIds
    if (coupon.appliesTo === 'categories') {
      const rows = await db
        .select({ id: products.id })
        .from(products)
        .where(and(eq(products.storeId, storeId), inArray(products.categoryId, coupon.targetIds)))
      productIds = rows.map((r) => r.id)
    }
    const set = new Set(productIds)
    eligible = ctx.lines.filter((l) => set.has(l.productId)).reduce((n, l) => n + l.total, 0)
    if (eligible <= 0) return { ok: false, message: 'الكود ده مش على المنتجات اللي في السلة' }
  }

  let discount = 0
  let freeShipping = false
  if (coupon.type === 'percent') {
    discount = applyBps(eligible, coupon.value)
    if (coupon.maxDiscount && discount > coupon.maxDiscount) discount = coupon.maxDiscount
  } else if (coupon.type === 'fixed') {
    discount = Math.min(coupon.value, eligible)
  } else if (coupon.type === 'free_shipping') {
    freeShipping = true
  }

  discount = Math.max(0, Math.min(discount, subtotal))

  return {
    ok: true,
    couponId: coupon.id,
    code: coupon.code,
    discount,
    freeShipping,
    message: 'الكود اتطبّق',
  }
}

/**
 * تسجيل استخدام الكوبون بعد اكتمال الطلب — داخل نفس معاملة الطلب.
 * بيزوّد العدّاد ويكتب صف استخدام، فالحدود بتُحترم والتقارير بتشتغل.
 */
export async function recordCouponUse(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  input: { couponId: string; storeId: string; orderId: string; customerId: string | null; amount: number },
) {
  await tx
    .update(coupons)
    .set({ usedCount: sql`${coupons.usedCount} + 1` })
    .where(eq(coupons.id, input.couponId))

  await tx.insert(couponUses).values({
    couponId: input.couponId,
    storeId: input.storeId,
    orderId: input.orderId,
    customerId: input.customerId,
    amount: input.amount,
  })
}
