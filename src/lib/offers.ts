import 'server-only'
import { and, eq, lte, or, gte, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { offers } from '@/db/schema'
import { applyBps } from './utils'
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
