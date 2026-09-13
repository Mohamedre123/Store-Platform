import 'server-only'
import { asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, loyaltyTransactions, rewards, wheelPrizes, wheelSettings } from '@/db/schema'
import { getLoyaltySettings } from '@/lib/loyalty'
import type { WheelPrizeInput } from '@/app/dashboard/loyalty/wheel-actions'

/**
 * بيانات شاشة الولاء والنقاط — صفحة اللوحة (`/dashboard/loyalty`) وتطبيق
 * الموبايل (`/api/app/loyalty`) الاتنين بيقروا من هنا.
 */
export async function loadLoyalty(storeId: string) {
  const [settings, [stats], recent, [wheel], prizes, rewardRows] = await Promise.all([
    getLoyaltySettings(storeId),
    db
      .select({
        members: sql<number>`count(*) filter (where ${customers.points} > 0)::int`,
        outstanding: sql<number>`coalesce(sum(${customers.points}), 0)::int`,
      })
      .from(customers)
      .where(eq(customers.storeId, storeId)),
    db
      .select({
        id: loyaltyTransactions.id,
        points: loyaltyTransactions.points,
        type: loyaltyTransactions.type,
        reason: loyaltyTransactions.reason,
        createdAt: loyaltyTransactions.createdAt,
        customerName: customers.name,
      })
      .from(loyaltyTransactions)
      .leftJoin(customers, eq(customers.id, loyaltyTransactions.customerId))
      .where(eq(loyaltyTransactions.storeId, storeId))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(20),
    db.select().from(wheelSettings).where(eq(wheelSettings.storeId, storeId)).limit(1),
    db.select().from(wheelPrizes).where(eq(wheelPrizes.storeId, storeId)).orderBy(wheelPrizes.position),
    db
      .select()
      .from(rewards)
      .where(eq(rewards.storeId, storeId))
      .orderBy(asc(rewards.sortOrder), asc(rewards.pointsCost)),
  ])

  return {
    settings,
    stats: { members: Number(stats?.members ?? 0), outstanding: Number(stats?.outstanding ?? 0) },
    recent,
    wheel: wheel ?? null,
    prizes,
    rewards: rewardRows,
  }
}

/**
 * جوايز العجلة بشكل خانات الفورم (النسبة والمبلغ بالجنيه، والفرصة نسبة مئوية) —
 * نفس اللي `saveWheelAction` بيستلمه. فورم اللوحة بيبدأ منها، ومسار التطبيق
 * بيبعتها زي ما هي لما يشغّل/يوقّف العجلة عشان الجوايز ما تتمسحش.
 */
export function wheelPrizeInputs(rows: Array<typeof wheelPrizes.$inferSelect>): WheelPrizeInput[] {
  return rows.map((p) => ({
    id: p.id,
    label: p.label,
    color: p.color,
    type: p.type,
    value: p.type === 'coupon_percent' || p.type === 'coupon_fixed' ? String(p.value / 100) : String(p.value),
    chance: String(p.probabilityBps / 100),
  }))
}
