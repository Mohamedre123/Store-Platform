'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { shippingRates, shippingZones, stores } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'
import { COUNTRIES, regionsFor } from '@/lib/regions'
import { fromMinorUnits, toMinorUnits } from '@/lib/utils'
import { spreadZonePrices, zonesFor, type ZoneKey } from '@/lib/shipping-zones'
import { activeCarrier, carrierCreds } from '@/lib/provider-store'
import { fetchCarrierTariff, supportsTariff } from '@/lib/integrations/shipping-tariff'

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
 * فتح وقفل الدفع عند الاستلام لوحده.
 *
 * منفصل عن حفظ المنطقة عن قصد: المفتاح ده بيتحرّك وحده والتاجر
 * مستنّي أثره فورًا. لو كان جزءًا من نموذج التسعير، التاجر اللي
 * ربط شركة شحن (والتسعير عنده متوقّف) ما كانش هيقدر يقفله أصلًا.
 *
 * ولو لسه مفيش منطقة شحن، بننشئ واحدة بالإعدادات الافتراضية —
 * التاجر اللي أول يوم ليه لازم يقفل الدفع عند الاستلام من غير ما
 * يظبّط ٢٧ محافظة الأول.
 */
export async function saveCodAction(country: string, enabled: boolean): Promise<ShippingState> {
  const { store } = await getDashboardContext()

  const [existing] = await db
    .select({ id: shippingZones.id })
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.country, country)))
    .limit(1)

  if (existing) {
    await db
      .update(shippingZones)
      .set({ codEnabled: enabled })
      .where(eq(shippingZones.id, existing.id))
  } else {
    const label = COUNTRIES.find((c) => c.code === country)?.name ?? country
    await db
      .insert(shippingZones)
      .values({ storeId: store.id, country, name: label, codEnabled: enabled })
  }

  revalidatePath('/dashboard/shipping')
  revalidatePath('/dashboard/payments')
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

/* ══════════════════ الملء التلقائي للأسعار ══════════════════ */

/**
 * بيكتب أسعار محافظات جاهزة (بالقرش) في المنطقة.
 *
 * منفصل عن `saveRatesAction` لأن ده بياخد قروشًا محسوبة لا نصًّا
 * كتبه التاجر — والتحويل مرتين كان بيقسم السعر على مية.
 */
async function writeRates(
  storeId: string,
  country: string,
  rates: Array<{ city: string; price: number }>,
): Promise<{ zoneMissing?: true; written: number; applied: Record<string, string> }> {
  const [zone] = await db
    .select({ id: shippingZones.id })
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.country, country)))
    .limit(1)

  if (!zone) return { zoneMissing: true, written: 0, applied: {} }

  const valid = new Set(regionsFor(country).map((r) => r.name))
  const rows = rates.filter((r) => valid.has(r.city) && r.price > 0)

  await db.transaction(async (tx) => {
    for (const rate of rows) {
      const [existing] = await tx
        .select({ id: shippingRates.id })
        .from(shippingRates)
        .where(and(eq(shippingRates.zoneId, zone.id), eq(shippingRates.city, rate.city)))
        .limit(1)

      if (existing) {
        await tx
          .update(shippingRates)
          .set({ price: rate.price, enabled: true })
          .where(eq(shippingRates.id, existing.id))
      } else {
        await tx.insert(shippingRates).values({
          zoneId: zone.id,
          storeId,
          city: rate.city,
          price: rate.price,
          enabled: true,
        })
      }
    }
  })

  revalidatePath('/dashboard/shipping')
  return {
    written: rows.length,
    applied: Object.fromEntries(rows.map((r) => [r.city, String(fromMinorUnits(r.price))])),
  }
}

/**
 * يملا الـ٢٧ محافظة من خمس أرقام.
 *
 * التاجر عنده كارت أسعار بالمناطق مش بالمحافظات — ده اللي شركة
 * الشحن بتدّيهوله فعلًا. فبياخد الكارت زي ما هو، وإحنا بنفرده.
 */
export async function applyZonePricesAction(
  country: string,
  prices: Record<string, string>,
): Promise<ShippingState & { filled?: number; applied?: Record<string, string> }> {
  const { store } = await getDashboardContext()

  const spread = spreadZonePrices(country, prices as Partial<Record<ZoneKey, string>>)
  if (spread.length === 0) return { error: 'اكتب سعر منطقة واحدة على الأقل' }

  const res = await writeRates(
    store.id,
    country,
    spread.map((s) => ({ city: s.city, price: toMinorUnits(s.price) })),
  )
  if (res.zoneMissing) return { error: 'لازم تحفظ إعدادات الدولة الأول' }

  return { ok: true, filled: res.written, applied: res.applied }
}

/**
 * يجيب التعريفة من شركة الشحن المربوطة ويملا بيها المحافظات.
 *
 * ده اللي التاجر بيتوقّعه أول ما يربط: ربطت الشركة، يبقى أسعارها
 * تبقى أسعاري. القعدة بعد الربط تملا ٢٧ خانة من ملف PDF هي بالظبط
 * الشغل اليدوي اللي الربط المفروض يشيله.
 *
 * **بيرجّع السبب لو فشل.** الشركة ممكن ترفض التسعير لأسباب مختلفة
 * تمامًا في العلاج، و«ما نفعش» بتخلّي التاجر يعيد المحاولة على
 * الفاضي. ولو فشل، الملء بالمناطق شغّال جنبه.
 */
export async function fetchCarrierRatesAction(
  country: string,
): Promise<ShippingState & { filled?: number; carrier?: string; zones?: number; applied?: Record<string, string> }> {
  const { store } = await getDashboardContext()

  const carrier = await activeCarrier(store.id)
  if (!carrier) {
    return { error: 'مفيش شركة شحن مربوطة بالـAPI. اربط واحدة فوق، أو املا بالمناطق تحت.' }
  }

  if (!supportsTariff(carrier.slug)) {
    return {
      error: `${carrier.displayName ?? carrier.slug} ما بتوفّرش تعريفة عبر الربط — املا بالمناطق تحت.`,
    }
  }

  const creds = await carrierCreds(store.id, carrier.slug)
  if (!creds) return { error: 'مفاتيح الشركة مش متسجّلة' }

  const tariff = await fetchCarrierTariff(carrier.slug, creds, {
    country,
    /*
      مدينة الاستلام بتغيّر السعر عند كل الشركات، والمتجر مالوش
      حقل عنوان عندنا — فبناخدها من إعدادات الشركة نفسها لو التاجر
      كتبها، وإلا القاهرة. القاهرة مش تخمين: هي مدينة الاستلام
      الافتراضية في حسابات بوسطة، وأغلب التجّار بيشحنوا منها.
    */
    pickupCity: (creds.values.pickupCity as string | undefined) ?? null,
  })
  if (!tariff.ok) return { error: tariff.error }

  /* سعر المنطقة بيتفرد على محافظاتها — نفس منطق الملء اليدوي */
  const byZone = new Map(tariff.rows.map((r) => [r.zone, r.price]))
  const rates: Array<{ city: string; price: number }> = []
  for (const zone of zonesFor(country)) {
    const price = byZone.get(zone.key)
    if (price === undefined) continue
    for (const city of zone.cities) rates.push({ city, price })
  }

  const res = await writeRates(store.id, country, rates)
  if (res.zoneMissing) return { error: 'لازم تحفظ إعدادات الدولة الأول' }

  return {
    ok: true,
    filled: res.written,
    carrier: tariff.carrier,
    zones: tariff.rows.length,
    applied: res.applied,
  }
}

/**
 * مفتاح تسجيل الشحنة تلقائيًا عند تأكيد الطلب.
 *
 * ## مفتوح افتراضيًا لأنه السلوك اللي كان شغّال
 * لو قفلناه، كل تاجر ربط شركة شحن بيلاقي الشحنات وقفت فجأة من غير
 * ما يغيّر حاجة. المفتاح بيدّي الاختيار للي محتاجه — مش بيغيّر
 * على اللي شغّال.
 */
export async function saveAutoShipAction(enabled: boolean): Promise<ShippingState> {
  const { store, user, actor } = await getDashboardContext()
  assertCan(actor, 'settings.manage')

  await db
    .update(stores)
    .set({ autoShipOnConfirm: enabled })
    .where(eq(stores.id, store.id))

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'auto_ship',
    before: { autoShipOnConfirm: store.autoShipOnConfirm },
    after: { autoShipOnConfirm: enabled },
  })

  revalidatePath('/dashboard/shipping')
  return { ok: true }
}
