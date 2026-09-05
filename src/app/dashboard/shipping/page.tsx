import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { shippingMethods, shippingRates, shippingZones } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { regionsFor } from '@/lib/regions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { ShippingForm } from './shipping-form'
import { CarriersManager } from './carriers-manager'
import { AutoShipCard } from './auto-ship-card'
import { MethodsManager } from './methods-manager'
import { readCarrierProviders, activeCarrier } from '@/lib/provider-store'
import { zonesFor } from '@/lib/shipping-zones'
import { supportsTariff } from '@/lib/integrations/shipping-tariff'
import { CARRIER_PROVIDERS } from '@/lib/providers'
import { platformOrigin } from '@/lib/domain'

export const metadata = { title: 'الشحن' }

export default async function ShippingPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'settings.manage')

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

  const [carriers, linked, methods] = await Promise.all([
    readCarrierProviders(store.id, CARRIER_PROVIDERS),
    activeCarrier(store.id),
    db
      .select()
      .from(shippingMethods)
      .where(eq(shippingMethods.storeId, store.id))
      .orderBy(asc(shippingMethods.sortOrder), asc(shippingMethods.createdAt)),
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

      {/*
        مفتاح التسجيل التلقائي جنب الشركات لا في صفحة إعدادات تانية:
        هو بيتكلّم عن الشركة اللي فوقه بالظبط، والتاجر بيقرّره وهو
        شايفها مربوطة.
      */}
      <Reveal delay={40}>
        <AutoShipCard
          initial={store.autoShipOnConfirm}
          carrierName={linked ? (linked.displayName ?? linked.slug) : null}
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

      {/*
        طرق الشحن بعد التسعير لا قبله.

        الطريقة فرق سعر على سعر المحافظة — فالتاجر لازم يكون سعّر
        محافظاته الأول عشان الفرق يبقى ليه معنى. والمعاينة تحت بتوريه
        الناتج برقم حقيقي من تسعيرته هو.
      */}
      <Reveal delay={80}>
        <MethodsManager
          currency={store.currency}
          sampleBase={zone?.defaultPrice ?? 5000}
          rows={methods.map((m) => ({
            id: m.id,
            name: m.name,
            hint: m.hint,
            priceDelta: m.priceDelta,
            minDays: m.minDays,
            maxDays: m.maxDays,
            enabled: m.enabled,
            sortOrder: m.sortOrder,
          }))}
        />
      </Reveal>
    </div>
  )
}
