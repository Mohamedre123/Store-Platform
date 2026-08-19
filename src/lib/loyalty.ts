import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, loyaltySettings, loyaltyTransactions } from '@/db/schema'

/**
 * نظام النقاط.
 *
 * قاعدتين بتحكموا كل حاجة هنا:
 *
 * 1. **النقاط تُمنح عند التسليم لا عند الطلب.** لو منحناها عند الطلب،
 *    عميل يطلب ويلغي عشرين مرة يطلع بنقاط من غير ما يشتري حاجة.
 * 2. **الرصيد بيتحسب من السجل لا من عمود مستقل.** كل حركة بتسجّل
 *    الرصيد بعدها، فأي خلاف بيبان وينحل بالرجوع للسجل.
 */

export type LoyaltyConfig = typeof loyaltySettings.$inferSelect

export async function getLoyaltySettings(storeId: string): Promise<LoyaltyConfig | null> {
  const [row] = await db
    .select()
    .from(loyaltySettings)
    .where(eq(loyaltySettings.storeId, storeId))
    .limit(1)
  return row ?? null
}

/** رصيد نقاط العميل — آخر رصيد مسجّل في السجل */
export async function getPointsBalance(customerId: string): Promise<number> {
  const [row] = await db
    .select({ balance: loyaltyTransactions.balanceAfter })
    .from(loyaltyTransactions)
    .where(eq(loyaltyTransactions.customerId, customerId))
    .orderBy(desc(loyaltyTransactions.createdAt))
    .limit(1)
  return row?.balance ?? 0
}

/**
 * تسجيل حركة نقاط.
 *
 * بتقرأ الرصيد وتكتب الحركة الجديدة برصيدها. الرصيد ما بينزلش تحت صفر
 * أبدًا — لو حاولنا نخصم أكتر من الموجود، بنخصم المتاح بس.
 */
export async function recordPoints(input: {
  storeId: string
  customerId: string
  points: number
  type: 'earn' | 'redeem' | 'expire' | 'manual' | 'refund'
  reason?: string
  orderId?: string
}): Promise<number> {
  const current = await getPointsBalance(input.customerId)
  const delta = input.points < 0 ? Math.max(input.points, -current) : input.points
  if (delta === 0) return current

  const balanceAfter = current + delta

  await db.transaction(async (tx) => {
    await tx.insert(loyaltyTransactions).values({
      storeId: input.storeId,
      customerId: input.customerId,
      points: delta,
      balanceAfter,
      type: input.type,
      reason: input.reason ?? null,
      orderId: input.orderId ?? null,
    })

    /**
     * الرصيد بيتنسخ على صف العميل عشان القراءة السريعة (القوائم
     * والتقارير)، والسجل يفضل هو المرجع لو حصل خلاف. النقاط المكتسبة
     * مدى الحياة بتزيد بس — هي أساس المستوى.
     */
    await tx
      .update(customers)
      .set({
        points: balanceAfter,
        lifetimePoints: delta > 0 ? sql`${customers.lifetimePoints} + ${delta}` : undefined,
      })
      .where(eq(customers.id, input.customerId))
  })

  return balanceAfter
}

/** النقاط المستحقة على مبلغ — بيرجّع صفر لو النظام مقفول */
export function pointsForAmount(settings: LoyaltyConfig | null, amount: number): number {
  if (!settings?.enabled) return 0
  const unit = settings.unitAmount || 100
  if (unit <= 0) return 0
  return Math.floor((amount / unit) * settings.pointsPerUnit)
}

/** قيمة النقاط بالفلوس */
export function pointsToMoney(settings: LoyaltyConfig | null, points: number): number {
  if (!settings?.enabled) return 0
  return points * settings.pointValue
}

/**
 * منح نقاط الطلب — بيتنادى لما الطلب يتسلّم.
 *
 * بيتأكد الأول إن الطلب ده ما اتمنحش نقاط قبل كده: تغيير الحالة
 * ذهابًا وإيابًا ما يمنحش نقاطًا مرتين.
 */
export async function awardOrderPoints(input: {
  storeId: string
  customerId: string
  orderId: string
  orderTotal: number
  orderNumber: number
}): Promise<number> {
  const settings = await getLoyaltySettings(input.storeId)
  if (!settings?.enabled) return 0

  const [already] = await db
    .select({ id: loyaltyTransactions.id })
    .from(loyaltyTransactions)
    .where(
      and(
        eq(loyaltyTransactions.orderId, input.orderId),
        eq(loyaltyTransactions.type, 'earn'),
      ),
    )
    .limit(1)

  if (already) return 0

  const points = pointsForAmount(settings, input.orderTotal)
  if (points <= 0) return 0

  await recordPoints({
    storeId: input.storeId,
    customerId: input.customerId,
    points,
    type: 'earn',
    reason: `طلب رقم ${input.orderNumber}`,
    orderId: input.orderId,
  })

  return points
}

/** أعلى مستوى وصله العميل حسب نقاطه المكتسبة مدى الحياة */
export function tierForPoints(settings: LoyaltyConfig | null, lifetimePoints: number) {
  const tiers = settings?.tiers ?? []
  if (tiers.length === 0) return null
  return (
    [...tiers]
      .filter((t) => lifetimePoints >= t.minPoints)
      .sort((a, b) => b.minPoints - a.minPoints)[0] ?? null
  )
}

/** المستوى الجاي والنقاط الناقصة ليه — بيحفّز العميل يكمّل */
export function nextTier(settings: LoyaltyConfig | null, lifetimePoints: number) {
  const tiers = settings?.tiers ?? []
  const upcoming = [...tiers]
    .filter((t) => lifetimePoints < t.minPoints)
    .sort((a, b) => a.minPoints - b.minPoints)[0]
  if (!upcoming) return null
  return { tier: upcoming, remaining: upcoming.minPoints - lifetimePoints }
}
