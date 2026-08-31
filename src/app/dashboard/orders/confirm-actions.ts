'use server'

import { revalidatePath } from 'next/cache'
import { getDashboardContext } from '@/lib/store-context'
import { requestConfirmation } from '@/lib/order-confirm'

export type ConfirmState = { ok?: boolean; error?: string } | null

/**
 * التاجر بيطلب تأكيدًا من العميل.
 *
 * يدوي لا تلقائي عن قصد — لسه. الرسالة التلقائية على كل طلب بتحوّل
 * التأكيد لروتين العميل بيتخطّاه، وبتستهلك من باقة الواتساب على
 * طلبات مالهاش مخاطرة أصلًا. التاجر بيشوف درجة الثقة جنبها ويقرّر.
 */
export async function requestConfirmationAction(orderId: string): Promise<ConfirmState> {
  const { store } = await getDashboardContext()

  const res = await requestConfirmation({ storeId: store.id, orderId })
  if (!res.ok) return { error: res.error }

  revalidatePath(`/dashboard/orders/${orderId}`)
  revalidatePath('/dashboard/orders')
  return { ok: true }
}
