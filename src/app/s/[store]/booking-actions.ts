'use server'

import { getStore } from '@/lib/storefront'
import { availableSlots, type Slot } from '@/lib/bookings'

/**
 * المواعيد المتاحة — بتتحسب على الخادم دايمًا.
 *
 * لو المتصفح حسبها من مواعيد العمل، اتنين يفتحوا الصفحة في نفس
 * الوقت ويحجزوا نفس المعاد — والتاجر يلاقي عميلين على الباب.
 * الخادم هو الوحيد اللي شايف الحجوزات القايمة.
 */
export async function slotsAction(input: {
  storeIdentifier: string
  productId: string
  date: string
}): Promise<Slot[]> {
  const store = await getStore(input.storeIdentifier)
  if (!store) return []

  return availableSlots({
    storeId: store.id,
    productId: input.productId,
    date: input.date,
  })
}
