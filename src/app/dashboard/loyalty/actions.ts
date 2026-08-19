'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { loyaltySettings } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { toMinorUnits } from '@/lib/utils'
import type { TierConfig } from '@/db/schema'

export type LoyaltyState = { ok?: boolean; error?: string } | null

export async function saveLoyaltyAction(input: {
  enabled: boolean
  /** كام نقطة للجنيه الواحد */
  pointsPerPound: string
  /** قيمة النقطة بالقروش */
  pointValue: string
  minPointsToRedeem: string
  welcomePoints: string
  reviewPoints: string
  tiers: TierConfig[]
}): Promise<LoyaltyState> {
  const { store } = await getDashboardContext()

  const perPound = Number(input.pointsPerPound)
  if (input.enabled && (!Number.isFinite(perPound) || perPound <= 0)) {
    return { error: 'عدد النقاط للجنيه لازم يكون أكبر من صفر' }
  }

  const pointValue = Number(input.pointValue)
  if (input.enabled && (!Number.isFinite(pointValue) || pointValue <= 0)) {
    return { error: 'قيمة النقطة لازم تكون أكبر من صفر' }
  }

  const values = {
    enabled: input.enabled,
    // النقاط محسوبة لكل جنيه = ١٠٠ قرش
    pointsPerUnit: Math.max(1, Math.round(perPound || 1)),
    unitAmount: 100,
    pointValue: Math.max(1, Math.round(pointValue || 1)),
    minPointsToRedeem: Math.max(0, Math.trunc(Number(input.minPointsToRedeem) || 0)),
    welcomePoints: Math.max(0, Math.trunc(Number(input.welcomePoints) || 0)),
    reviewPoints: Math.max(0, Math.trunc(Number(input.reviewPoints) || 0)),
    tiers: input.tiers
      .filter((t) => t.name.trim() && Number.isFinite(t.minPoints))
      .sort((a, b) => a.minPoints - b.minPoints),
  }

  const [existing] = await db
    .select({ storeId: loyaltySettings.storeId })
    .from(loyaltySettings)
    .where(eq(loyaltySettings.storeId, store.id))
    .limit(1)

  if (existing) {
    await db.update(loyaltySettings).set(values).where(eq(loyaltySettings.storeId, store.id))
  } else {
    await db.insert(loyaltySettings).values({ ...values, storeId: store.id })
  }

  revalidatePath('/dashboard/loyalty')
  return { ok: true }
}
