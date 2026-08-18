import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { shippingRates, shippingZones } from '@/db/schema'
import { getStore } from '@/lib/storefront'
import { getCheckoutSettings, getPaymentMethods } from '@/lib/checkout'
import { regionsFor } from '@/lib/regions'
import { CheckoutForm } from './checkout-form'
import { EmptyCart } from './empty-cart'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'إتمام الطلب' }

export default async function CheckoutPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const [settings, payments] = await Promise.all([
    getCheckoutSettings(store.id),
    getPaymentMethods(store.id),
  ])

  const [zone] = await db
    .select()
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.country, store.country)))
    .limit(1)

  const rates = zone
    ? await db
        .select({ city: shippingRates.city, price: shippingRates.price })
        .from(shippingRates)
        .where(and(eq(shippingRates.zoneId, zone.id), eq(shippingRates.enabled, true)))
    : []

  const shippingByCity = Object.fromEntries(rates.map((r) => [r.city, r.price]))

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <h1 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">إتمام الطلب</h1>

      <EmptyCart>
        <CheckoutForm
          storeIdentifier={identifier}
          currency={store.currency}
          country={store.country}
          regions={regionsFor(store.country)}
          shippingByCity={shippingByCity}
          defaultShipping={zone?.defaultPrice ?? 0}
          freeOver={zone?.freeShippingEnabled ? zone.freeOverAmount : null}
          payments={
            payments.length
              ? payments.map((p) => ({
                  gateway: p.gateway,
                  displayName: p.displayName,
                  instructions: p.instructions,
                }))
              : [{ gateway: 'cod', displayName: 'الدفع عند الاستلام', instructions: null }]
          }
          config={{
            fieldName: settings?.fieldName ?? 'required',
            fieldPhone: settings?.fieldPhone ?? 'required',
            fieldEmail: settings?.fieldEmail ?? 'optional',
            fieldCity: settings?.fieldCity ?? 'required',
            fieldArea: settings?.fieldArea ?? 'optional',
            fieldStreet: settings?.fieldStreet ?? 'required',
            fieldBuilding: settings?.fieldBuilding ?? 'optional',
            fieldNotes: settings?.fieldNotes ?? 'optional',
            addressMode: settings?.addressMode ?? 'structured',
            showCouponField: settings?.showCouponField ?? true,
            otpEnabled: settings?.otpEnabled ?? false,
            minOrderEnabled: settings?.minOrderEnabled ?? false,
            minOrderAmount: settings?.minOrderAmount ?? 0,
            captureIncomplete: settings?.captureIncompleteOrders ?? true,
          }}
        />
      </EmptyCart>
    </div>
  )
}
