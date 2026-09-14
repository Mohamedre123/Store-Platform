import 'server-only'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { shippingMethods, shippingRates, shippingZones } from '@/db/schema'
import { activeCarrier, readCarrierProviders } from '@/lib/provider-store'
import { CARRIER_PROVIDERS } from '@/lib/providers'

/**
 * بيانات صفحة الشحن — صفحة اللوحة ومسار التطبيق (`/api/app/shipping`) بيقروا من هنا.
 */
export async function loadShipping(storeId: string, country: string) {
  const [zone] = await db
    .select()
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.country, country)))
    .limit(1)

  const rateRows = zone
    ? await db
        .select({ city: shippingRates.city, price: shippingRates.price, enabled: shippingRates.enabled })
        .from(shippingRates)
        .where(eq(shippingRates.zoneId, zone.id))
    : []

  const rates: Record<string, { price: number; enabled: boolean }> = Object.fromEntries(
    rateRows.map((r) => [r.city, { price: r.price, enabled: r.enabled }]),
  )

  const [carriers, linked, methods] = await Promise.all([
    readCarrierProviders(storeId, CARRIER_PROVIDERS),
    activeCarrier(storeId),
    db
      .select()
      .from(shippingMethods)
      .where(eq(shippingMethods.storeId, storeId))
      .orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.createdAt)),
  ])

  return { zone: zone ?? null, rates, carriers, linked, methods }
}
