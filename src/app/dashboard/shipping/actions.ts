'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { shippingRates, shippingZones } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { COUNTRIES, regionsFor } from '@/lib/regions'
import { toMinorUnits } from '@/lib/utils'

export type ShippingState = { ok?: boolean; error?: string } | null

/** إعدادات المنطقة: السعر الافتراضي والشحن المجاني ومدة التوصيل */
export async function saveZoneAction(input: {
  country: string
  enabled: boolean
  defaultPrice: string
  freeShippingEnabled: boolean
  freeOverAmount: string
  minDays: number
  maxDays: number
  codEnabled: boolean
}): Promise<ShippingState> {
  const { store } = await getDashboardContext()

  const values = {
    enabled: input.enabled,
    defaultPrice: toMinorUnits(input.defaultPrice),
    freeShippingEnabled: input.freeShippingEnabled,
    freeOverAmount: toMinorUnits(input.freeOverAmount),
    minDays: Math.max(0, Math.trunc(input.minDays)),
    maxDays: Math.max(0, Math.trunc(input.maxDays)),
    codEnabled: input.codEnabled,
  }

  if (values.maxDays < values.minDays) {
    return { error: 'أقصى مدة توصيل لازم تكون أكبر من أقلها' }
  }

  const [existing] = await db
    .select({ id: shippingZones.id })
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.country, input.country)))
    .limit(1)

  if (existing) {
    await db.update(shippingZones).set(values).where(eq(shippingZones.id, existing.id))
  } else {
    const label = COUNTRIES.find((c) => c.code === input.country)?.name ?? input.country
    await db
      .insert(shippingZones)
      .values({ ...values, storeId: store.id, country: input.country, name: label })
  }

  revalidatePath('/dashboard/shipping')
  return { ok: true }
}

/**
 * أسعار المحافظات.
 *
 * تُحفظ دفعة واحدة لا واحدة واحدة: التاجر بيظبط ٢٧ محافظة في جلسة
 * واحدة، ولو كل تعديل طلب منفصل يبقى ٢٧ رحلة للخادم وتجربة بطيئة.
 *
 * المحافظة اللي سعرها فاضي بتتشال، فترجع للسعر الافتراضي بدل ما
 * نخزّن صفرًا يوهم إن الشحن مجاني لها.
 */
export async function saveRatesAction(
  country: string,
  rates: Array<{ city: string; price: string; enabled: boolean }>,
): Promise<ShippingState> {
  const { store } = await getDashboardContext()

  const [zone] = await db
    .select({ id: shippingZones.id })
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.country, country)))
    .limit(1)

  if (!zone) return { error: 'لازم تحفظ إعدادات الدولة الأول' }

  const valid = new Set(regionsFor(country).map((r) => r.name))
  const filled = rates.filter((r) => valid.has(r.city) && r.price.trim() !== '')
  const emptied = rates.filter((r) => valid.has(r.city) && r.price.trim() === '').map((r) => r.city)

  await db.transaction(async (tx) => {
    if (emptied.length) {
      await tx
        .delete(shippingRates)
        .where(and(eq(shippingRates.zoneId, zone.id), inArray(shippingRates.city, emptied)))
    }

    for (const rate of filled) {
      const values = { price: toMinorUnits(rate.price), enabled: rate.enabled }

      const [existing] = await tx
        .select({ id: shippingRates.id })
        .from(shippingRates)
        .where(and(eq(shippingRates.zoneId, zone.id), eq(shippingRates.city, rate.city)))
        .limit(1)

      if (existing) {
        await tx.update(shippingRates).set(values).where(eq(shippingRates.id, existing.id))
      } else {
        await tx.insert(shippingRates).values({
          ...values,
          zoneId: zone.id,
          storeId: store.id,
          city: rate.city,
        })
      }
    }
  })

  revalidatePath('/dashboard/shipping')
  return { ok: true }
}
