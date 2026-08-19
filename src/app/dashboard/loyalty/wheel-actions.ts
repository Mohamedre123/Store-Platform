'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { wheelPrizes, wheelSettings } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { toMinorUnits } from '@/lib/utils'

export type WheelPrizeInput = {
  id?: string
  label: string
  color: string
  type: 'points' | 'coupon_percent' | 'coupon_fixed' | 'free_shipping' | 'nothing'
  /** نسبة/نقاط/مبلغ حسب النوع */
  value: string
  /** فرصة الظهور كنسبة مئوية */
  chance: string
}

export type WheelState = { ok?: boolean; error?: string } | null

/**
 * حفظ العجلة وجوائزها.
 *
 * الاحتمالات بتتخزّن بنقاط الأساس. مش بنفرض إن مجموعها ١٠٠٪ بالظبط —
 * السحب بيوزّع نسبيًا على المجموع مهما كان، فالتاجر ما يتقفلش عليه
 * بسبب كسر ناقص. بس بننبّهه لو المجموع بعيد.
 */
export async function saveWheelAction(input: {
  enabled: boolean
  title: string
  subtitle: string
  triggerAfterSeconds: string
  freeSpinsPerDay: string
  prizes: WheelPrizeInput[]
}): Promise<WheelState> {
  const { store } = await getDashboardContext()

  const prizes = input.prizes
    .filter((p) => p.label.trim())
    .map((p, i) => ({
      label: p.label.trim(),
      color: p.color || '#634b9a',
      type: p.type,
      // النسبة بنقاط أساس، والمبلغ بالوحدة الصغرى، والنقاط رقم صحيح
      value:
        p.type === 'coupon_percent'
          ? Math.round((Number(p.value) || 0) * 100)
          : p.type === 'coupon_fixed'
            ? toMinorUnits(p.value)
            : Math.trunc(Number(p.value) || 0),
      probabilityBps: Math.max(0, Math.round((Number(p.chance) || 0) * 100)),
      position: i,
      isActive: true,
    }))

  if (input.enabled && prizes.length < 2) {
    return { error: 'العجلة محتاجة جايزتين على الأقل' }
  }
  if (input.enabled && prizes.every((p) => p.probabilityBps === 0)) {
    return { error: 'حدّد فرصة ظهور لجايزة واحدة على الأقل' }
  }

  const settings = {
    enabled: input.enabled,
    title: input.title.trim() || 'جرّب حظك',
    subtitle: input.subtitle.trim() || null,
    triggerAfterSeconds: Math.max(0, Math.trunc(Number(input.triggerAfterSeconds) || 15)),
    freeSpinsPerDay: Math.max(1, Math.trunc(Number(input.freeSpinsPerDay) || 1)),
  }

  const [existing] = await db
    .select({ storeId: wheelSettings.storeId })
    .from(wheelSettings)
    .where(eq(wheelSettings.storeId, store.id))
    .limit(1)

  if (existing) {
    await db.update(wheelSettings).set(settings).where(eq(wheelSettings.storeId, store.id))
  } else {
    await db.insert(wheelSettings).values({ ...settings, storeId: store.id })
  }

  /**
   * الجوائز بتتكتب من الأول: عددها صغير، والاستبدال الكامل أبسط وأأمن
   * من مطابقة كل صف — ومفيش بيانات تاريخية بتضيع لأن السحبات بتسجّل
   * اسم الجايزة عندها.
   */
  await db.delete(wheelPrizes).where(eq(wheelPrizes.storeId, store.id))
  if (prizes.length > 0) {
    await db.insert(wheelPrizes).values(prizes.map((p) => ({ ...p, storeId: store.id })))
  }

  revalidatePath('/dashboard/loyalty')
  return { ok: true }
}
