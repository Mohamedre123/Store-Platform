import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { shippingRates, shippingZones } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import { getOrderQuota } from '@/lib/entitlements'
import { regionsFor } from '@/lib/regions'
import { getCheckoutSettings } from '@/lib/checkout'

/**
 * إعدادات شاشة الطلب اليدوي — صفحة `/dashboard/orders/new` ومسار التطبيق (`/api/app/manual-order`).
 */
export async function loadManualOrderSetup(store: ActiveStore) {
  const [quota, settings, zone] = await Promise.all([
    getOrderQuota(store),
    getCheckoutSettings(store.id),
    db
      .select({ id: shippingZones.id })
      .from(shippingZones)
      .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.country, store.country)))
      .limit(1)
      .then((r) => r[0] ?? null),
  ])

  /**
   * المدن اللي ليها سعر شحن مفعّل.
   *
   * بتتعرض جنب اسم المحافظة في القايمة: التاجر اللي بيختار محافظة
   * مش مسعّرة بيشوف «بلا سعر شحن» قبل ما يحفظ، بدل ما يكتشف الصفر
   * في الفاتورة بعد ما بعت البضاعة.
   */
  const cities = zone
    ? await db
        .select({ city: shippingRates.city })
        .from(shippingRates)
        .where(and(eq(shippingRates.zoneId, zone.id), eq(shippingRates.enabled, true)))
    : []

  return {
    quota: { blocked: quota.blocked, limit: quota.limit },
    config: {
      currency: store.currency,
      allowOversell: store.manualOversell,
      allowCustomPrice: store.manualCustomPricing,
      allowDeposit: store.manualDepositEnabled,
      regions: regionsFor(store.country).map((r) => ({ code: r.code, name: r.name })),
      shippingCities: cities.map((c) => c.city),
      pickupAllowed: settings.deliveryMode !== 'delivery',
    },
  }
}
