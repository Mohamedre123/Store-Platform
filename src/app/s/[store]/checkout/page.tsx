import { notFound } from 'next/navigation'
import { getStore } from '@/lib/storefront'
import { CheckoutPlaceholder } from './placeholder'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'إتمام الطلب' }

export default async function CheckoutPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  return <CheckoutPlaceholder currency={store.currency} whatsapp={store.whatsapp} storeName={store.name} />
}
