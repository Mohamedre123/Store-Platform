'use server'

import { revalidatePath } from 'next/cache'
import { getStore } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/customer-auth'
import { getLoyaltySettings } from '@/lib/loyalty'
import { redeemReward } from '@/lib/rewards'

export type RedeemState = { ok?: boolean; code?: string; label?: string; error?: string } | null

/**
 * العميل يسترد مكافأة بنقاطه.
 *
 * الهوية بتتقرا من الجلسة لا من الطلب: لو أخدنا معرّف العميل من
 * المتصفح، أي حد يسترد بنقاط حد تاني.
 */
export async function redeemRewardAction(
  storeIdentifier: string,
  rewardId: string,
): Promise<RedeemState> {
  const store = await getStore(storeIdentifier)
  if (!store) return { error: 'المتجر مش موجود' }

  const customer = await getCurrentCustomer(store.id)
  if (!customer) return { error: 'سجّل دخولك الأول' }

  const settings = await getLoyaltySettings(store.id)
  const result = await redeemReward({
    storeId: store.id,
    customerId: customer.id,
    rewardId,
    settings,
  })

  if (!result.ok) return { error: result.message }

  revalidatePath(`/s/${store.slug}/account`)
  return { ok: true, code: result.code, label: result.label }
}
