'use server'

import { getStore } from '@/lib/storefront'
import { spinWheel } from '@/lib/wheel'

export async function spinWheelAction(input: {
  storeIdentifier: string
  phone: string
}): Promise<
  | { ok: true; prize: { label: string; couponCode?: string }; index: number }
  | { ok: false; error: string }
> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return { ok: false, error: 'المتجر مش موجود' }

  const res = await spinWheel({
    storeId: store.id,
    storeName: store.name,
    phone: input.phone,
  })

  if (!res.ok) return res
  return { ok: true, prize: { label: res.prize.label, couponCode: res.prize.couponCode }, index: res.index }
}
