import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { shippingZones } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import { loadShipping } from '@/lib/shipping-data'
import { CARRIER_PROVIDERS, webhookPath } from '@/lib/providers'
import { platformOrigin } from '@/lib/domain'
import { regionsFor } from '@/lib/regions'
import { zonesFor } from '@/lib/shipping-zones'
import { supportsTariff } from '@/lib/integrations/shipping-tariff'
import { fromMinorUnits } from '@/lib/utils'
import { providerView } from '@/lib/app-providers'
import { saveZoneAction } from '@/app/dashboard/shipping/actions'

const amount = (v: number) => (v ? String(fromMinorUnits(v)) : '')

/** شكل شاشة الشحن اللي تطبيق الموبايل بيستلمه — نفس اللي صفحة اللوحة بتعرضه */
export async function shippingPayload(store: ActiveStore) {
  const { zone, rates, carriers, linked, methods } = await loadShipping(store.id, store.country)
  const origin = platformOrigin()

  return {
    country: store.country,
    currency: store.currency,
    codEnabled: zone?.codEnabled ?? true,
    autoShip: store.autoShipOnConfirm,
    carrier: linked ? { name: linked.displayName ?? linked.slug, canFetch: supportsTariff(linked.slug) } : null,
    zone: {
      enabled: zone?.enabled ?? true,
      defaultPrice: amount(zone?.defaultPrice ?? 5000),
      freeShippingEnabled: zone?.freeShippingEnabled ?? false,
      freeOverAmount: amount(zone?.freeOverAmount ?? 0),
      minDays: zone?.minDays ?? 2,
      maxDays: zone?.maxDays ?? 5,
    },
    regions: regionsFor(store.country).map((r) => ({ name: r.name, price: rates[r.name] ? amount(rates[r.name].price) : '' })),
    zones: zonesFor(store.country).map((z) => ({ key: z.key, label: z.label, hint: z.hint })),
    carriers: CARRIER_PROVIDERS.map((def) =>
      providerView(def, carriers[def.slug], origin + webhookPath('ship', def.slug, store.id)),
    ),
    /* الشركات اللي سعرها بيغلب التسعير اليدوي — زي تحذير `CarriersManager` */
    pricedCarriers: CARRIER_PROVIDERS.filter((c) => carriers[c.slug]?.enabled && (carriers[c.slug]?.flatRate ?? 0) > 0).map((c) => c.name),
    sampleBase: zone?.defaultPrice ?? 5000,
    methods: methods.map((m) => ({
      id: m.id,
      name: m.name,
      hint: m.hint ?? '',
      priceDelta: m.priceDelta,
      minDays: m.minDays,
      maxDays: m.maxDays,
      enabled: m.enabled,
      sortOrder: m.sortOrder,
    })),
  }
}

/** كود الدفع عند الاستلام الحالي — `saveZoneAction` بيكتبه مع باقي المنطقة */
export async function currentCod(store: ActiveStore): Promise<boolean> {
  const [zone] = await db
    .select({ codEnabled: shippingZones.codEnabled })
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.country, store.country)))
    .limit(1)
  return zone?.codEnabled ?? true
}

/**
 * منطقة الشحن لازم تكون موجودة قبل أسعار المحافظات.
 *
 * صفحة اللوحة بتحفظ الإعدادات العامة وبعدها الأسعار في نفس الضغطة؛ في التطبيق كل واحدة
 * ليها لوحة — فالتاجر اللي أول مرة يكتب أسعار ما يلاقيش «احفظ إعدادات الدولة الأول».
 * القيم نفس الافتراضي اللي الصفحة بتعرضه.
 */
export async function ensureShippingZone(store: ActiveStore): Promise<void> {
  const [zone] = await db
    .select({ id: shippingZones.id })
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.country, store.country)))
    .limit(1)
  if (zone) return
  await saveZoneAction({
    country: store.country,
    enabled: true,
    defaultPrice: '50',
    freeShippingEnabled: false,
    freeOverAmount: '0',
    minDays: 2,
    maxDays: 5,
    codEnabled: true,
  })
}
