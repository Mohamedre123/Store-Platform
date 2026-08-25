import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { shippingRates, shippingZones } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { regionsFor } from '@/lib/regions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { ShippingForm } from './shipping-form'
import { CarriersManager } from './carriers-manager'
import { readCarrierProviders, activeCarrier } from '@/lib/provider-store'
import { zonesFor } from '@/lib/shipping-zones'
import { supportsTariff } from '@/lib/integrations/shipping-tariff'
import { CARRIER_PROVIDERS } from '@/lib/providers'
import { platformOrigin } from '@/lib/domain'

export const metadata = { title: 'الشحن' }

export default async function ShippingPage() {
  const { store } = await getDashboardContext()

  const [zone] = await db
    .select()
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.country, store.country)))
    .limit(1)

  const rateRows = zone
    ? await db
        .select({ city: shippingRates.city, price: shippingRates.price, enabled: shippingRates.enabled })
        .from(shippingRates)
        .where(eq(shippingRates.zoneId, zone.id))
    : []

  const rates = Object.fromEntries(rateRows.map((r) => [r.city, { price: r.price, enabled: r.enabled }]))

  const [carriers, linked] = await Promise.all([
    readCarrierProviders(store.id, CARRIER_PROVIDERS),
    activeCarrier(store.id),
  ])

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="الشحن"
        description="اربط شركة شحن وهات تعريفتها، أو حدّد أسعارك بنفسك لكل منطقة."
      />

      {/*
        الشركات فوق التسعير: التاجر بيربط الأول، وبعدين ينزل يسحب
        تعريفتها بضغطة. الترتيب العكسي كان بيخلّيه يملا ٢٧ محافظة
        بإيده وبعدين يكتشف إن الربط كان هيجيبها.
      */}
      <Reveal>
        <CarriersManager
          providers={carriers}
          origin={platformOrigin()}
          storeId={store.id}
          currency={store.currency}
        />
      </Reveal>

      <Reveal delay={60}>
        <ShippingForm
          country={store.country}
          currency={store.currency}
          regions={regionsFor(store.country)}
          zone={{
            enabled: zone?.enabled ?? true,
            defaultPrice: zone?.defaultPrice ?? 5000,
            freeShippingEnabled: zone?.freeShippingEnabled ?? false,
            freeOverAmount: zone?.freeOverAmount ?? 0,
            minDays: zone?.minDays ?? 2,
            maxDays: zone?.maxDays ?? 5,
            codEnabled: zone?.codEnabled ?? true,
          }}
          rates={rates}
          zones={zonesFor(store.country)}
          carrier={
            linked
              ? {
                  name: linked.displayName ?? linked.slug,
                  canFetch: supportsTariff(linked.slug),
                }
              : null
          }
        />
      </Reveal>
    </div>
  )
}
