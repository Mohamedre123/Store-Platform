import 'server-only'
import { and, eq, lte, or, gte, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { offers } from '@/db/schema'
import { applyBps, formatMoney } from './utils'
import type { PricedLine } from './checkout'

/**
 * عروض الكمية.
 *
 * «اشترِ أكتر تدفع أقل» — أبسط عرض وأكتر واحد بيشتغل: بيرفع قيمة
 * الطلب من غير ما يخصم من هامش المنتج الواحد.
 *
 * الخصم بيتحسب على الخادم زي الكوبونات بالظبط. المتصفح بيعرض التوقّع،
 * والخادم هو اللي بيحسب الحقيقة.
 */

export type QuantityTier = { qty: number; discountBps: number }

export type ActiveOffer = {
  id: string
  name: string
  badge: string | null
  tiers: QuantityTier[]
  /** فاضي = ينطبق على كل المنتجات */
  productIds: string[]
}

/** العروض الشغّالة دلوقتي — المفعّلة وفي مدتها */
export async function getActiveOffers(storeId: string): Promise<ActiveOffer[]> {
  const rows = await db
    .select()
    .from(offers)
    .where(
      and(
        eq(offers.storeId, storeId),
        eq(offers.isActive, true),
        eq(offers.type, 'quantity_break'),
        or(isNull(offers.startsAt), lte(offers.startsAt, new Date()))!,
        or(isNull(offers.endsAt), gte(offers.endsAt, new Date()))!,
      ),
    )
    .orderBy(offers.sortOrder)

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    badge: r.badge,
    tiers: normalizeTiers((r.config as { tiers?: QuantityTier[] })?.tiers ?? []),
    productIds: r.productIds,
  }))
}

/** ترتيب الشرائح تنازليًا عشان نلاقي أعلى شريحة مستحقّة أول ما نلف */
function normalizeTiers(tiers: QuantityTier[]): QuantityTier[] {
  return tiers
    .filter((t) => Number.isFinite(t.qty) && t.qty > 1 && t.discountBps > 0)
    .sort((a, b) => b.qty - a.qty)
}

export type OfferDiscount = { amount: number; label: string } | null

/**
 * أعلى خصم كمية مستحق على السلة.
 *
 * الكمية بتتحسب لكل عرض على حدة: عرض على منتجات محددة بيعدّ منتجاته
 * بس، والعرض العام بيعدّ السلة كلها. لو أكتر من عرض ينطبق، بناخد
 * الأعلى — مش بنجمعهم، عشان ما نخسرش من غير ما نقصد.
 */
export function computeOfferDiscount(lines: PricedLine[], offersList: ActiveOffer[]): OfferDiscount {
  let best: OfferDiscount = null

  for (const offer of offersList) {
    const scoped = offer.productIds.length
      ? lines.filter((l) => offer.productIds.includes(l.productId))
      : lines

    if (scoped.length === 0) continue

    const qty = scoped.reduce((n, l) => n + l.quantity, 0)
    const subtotal = scoped.reduce((n, l) => n + l.total, 0)

    const tier = offer.tiers.find((t) => qty >= t.qty)
    if (!tier) continue

    const amount = applyBps(subtotal, tier.discountBps)
    if (amount > 0 && (!best || amount > best.amount)) {
      best = { amount, label: offer.name }
    }
  }

  return best
}

/** نص العرض المعروض على صفحة المنتج — «خد ٣ ووفّر ١٥٪» */
export function offerHint(offer: ActiveOffer): string | null {
  const lowest = [...offer.tiers].sort((a, b) => a.qty - b.qty)[0]
  if (!lowest) return null
  return `خد ${lowest.qty} ووفّر ${Math.round(lowest.discountBps / 100)}٪`
}

/* ────────────────────────── الباقات ────────────────────────── */

export type BundleConfig = {
  /** المنتجات اللي لازم تكون كلها في السلة عشان الباقة تشتغل */
  productIds: string[]
  /** سعر الباقة كلها، بالقرش */
  bundlePrice: number
}

export type ActiveBundle = {
  id: string
  name: string
  badge: string | null
  productIds: string[]
  bundlePrice: number
}

/**
 * الباقات الشغّالة دلوقتي.
 *
 * ## العمود ده كان في المخطط من أول يوم
 * `offers.type` بيقبل `fixed_bundle` من ساعة ما اتكتب، والتعليق
 * فوقه بيوصف شكل الإعداد بالحرف — ومحدّش كان بيقراه. نفس النمط
 * اللي PLAN بيحذّر منه: عمود موجود، وكود بيكتبه، ومفيش حد بيشغّله.
 */
export async function getActiveBundles(storeId: string): Promise<ActiveBundle[]> {
  const rows = await db
    .select()
    .from(offers)
    .where(
      and(
        eq(offers.storeId, storeId),
        eq(offers.isActive, true),
        eq(offers.type, 'fixed_bundle'),
        or(isNull(offers.startsAt), lte(offers.startsAt, new Date()))!,
        or(isNull(offers.endsAt), gte(offers.endsAt, new Date()))!,
      ),
    )
    .orderBy(offers.sortOrder)

  return rows
    .map((r) => {
      const cfg = r.config as Partial<BundleConfig>
      return {
        id: r.id,
        name: r.name,
        badge: r.badge,
        productIds: Array.isArray(cfg.productIds) ? cfg.productIds : [],
        bundlePrice: Number(cfg.bundlePrice) || 0,
      }
    })
    /* باقة بمنتج واحد مش باقة، وبسعر صفر بتدّي الطلب ببلاش */
    .filter((b) => b.productIds.length >= 2 && b.bundlePrice > 0)
}

/**
 * خصم الباقة على السلة.
 *
 * ## الطقم الكامل هو الشرط
 * الباقة بتشتغل لما **كل** منتجاتها تكون في السلة. لو ناقص واحد،
 * مفيش خصم — وده الفرق بينها وبين خصم الكمية. العميل اللي شايل
 * منتج من الباقة لازم يشوف السعر يرجع لأصله، وإلا بيبقى واخد سعر
 * الباقة من غير ما يشتريها.
 *
 * ## والأطقم بتتعدّ
 * اللي حاطط اتنين من كل منتج بياخد الخصم مرتين. `min` على الكميات
 * بتقول كام طقم كامل موجود فعلًا — من غيرها، اللي حاطط عشرة من
 * واحد وواحد من التاني كان هياخد عشر خصومات على طقم واحد.
 *
 * ## والخصم ما بيبقاش أكبر من قيمة اللي في السلة
 * لو التاجر ظبط سعر باقة أغلى من مجموع المنتجات، الفرق بيطلع سالب
 * والخصم بيبقى صفر — لا بيزوّد الحساب.
 */
export function computeBundleDiscount(
  lines: PricedLine[],
  bundles: ActiveBundle[],
): OfferDiscount {
  let best: OfferDiscount = null

  for (const bundle of bundles) {
    /* كمية كل منتج من منتجات الباقة في السلة */
    const quantities = bundle.productIds.map((id) =>
      lines.filter((l) => l.productId === id).reduce((n, l) => n + l.quantity, 0),
    )

    const sets = Math.min(...quantities)
    if (sets < 1) continue

    /*
      سعر الطقم الواحد = أرخص سعر وحدة لكل منتج.

      المنتج بمتغيّرات ليه أسعار مختلفة في نفس السلة. لو أخدنا
      الأغلى، الخصم بيطلع أكبر من اللي التاجر قصده والفرق بيطلع
      من جيبه. الأرخص بيخلّي الخصم دايمًا في صالحه.
    */
    let setPrice = 0
    let complete = true
    for (const id of bundle.productIds) {
      const prices = lines.filter((l) => l.productId === id).map((l) => l.price)
      if (prices.length === 0) {
        complete = false
        break
      }
      setPrice += Math.min(...prices)
    }
    if (!complete) continue

    const perSet = setPrice - bundle.bundlePrice
    if (perSet <= 0) continue

    const amount = perSet * sets
    if (!best || amount > best.amount) {
      best = { amount, label: bundle.name }
    }
  }

  return best
}

/** نص الباقة على صفحة المنتج — «الطقم كله بـ٣٥٠ بدل ٤٢٠» */
export function bundleHint(bundle: ActiveBundle, fullPrice: number, currency: string): string | null {
  if (fullPrice <= bundle.bundlePrice) return null
  return `الطقم كله بـ${formatMoney(bundle.bundlePrice, currency)} بدل ${formatMoney(fullPrice, currency)}`
}
