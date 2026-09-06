import { notFound } from 'next/navigation'
import { headers } from 'next/headers'
import { getStore, getStoreTheme, listCartUpsell, marketCurrency, priceForMarket } from '@/lib/storefront'
import { CartPageClient } from './cart-page-client'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'السلة' }

export default async function CartPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const isPreview = (await headers()).get('x-zawya-preview') === '1'
  const theme = await getStoreTheme(store.id, isPreview)
  const { cart } = theme.custom

  const upsell = cart.showUpsell ? priceForMarket(await listCartUpsell(store.id), store) : []

  return (
    <CartPageClient
      currency={marketCurrency(store)}
      emptyMessage={cart.emptyMessage}
      freeShippingBar={cart.freeShippingBar}
      freeOver={cart.freeShippingThreshold}
      showNotes={cart.showNotes}
      upsell={upsell}
      upsellTitle={cart.upsellTitle}
    />
  )
}
