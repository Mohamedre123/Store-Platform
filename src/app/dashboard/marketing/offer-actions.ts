'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { offers } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'

export type OfferInput = {
  id?: string
  name: string
  badge: string
  /** الشرائح: كمية ونسبة خصم — «٣ قطع خصم ١٥٪» */
  tiers: Array<{ qty: string; percent: string }>
  productIds: string[]
  isActive: boolean
}

export type OfferState = { ok?: boolean; error?: string } | null

/**
 * حفظ عرض كمية.
 *
 * الشرائح بتتخزّن بنقاط الأساس زي كل النِسَب في المنصة. الشريحة اللي
 * كميتها أقل من ٢ بتتشال — «اشترِ ١ ووفّر» مش عرض، ده خصم عادي مكانه
 * سعر المنتج نفسه.
 */
export async function saveOfferAction(input: OfferInput): Promise<OfferState> {
  const { store } = await getDashboardContext()

  const name = input.name.trim()
  if (!name) return { error: 'اكتب اسم العرض' }

  const tiers = input.tiers
    .map((t) => ({ qty: Math.trunc(Number(t.qty)), discountBps: Math.round(Number(t.percent) * 100) }))
    .filter((t) => Number.isFinite(t.qty) && t.qty >= 2 && t.discountBps > 0 && t.discountBps <= 9000)
    .sort((a, b) => a.qty - b.qty)

  if (tiers.length === 0) {
    return { error: 'ضيف شريحة واحدة على الأقل: كمية من ٢ فأكتر ونسبة خصم' }
  }

  const values = {
    name,
    badge: input.badge.trim() || null,
    type: 'quantity_break' as const,
    config: { tiers },
    productIds: input.productIds,
    isActive: input.isActive,
  }

  if (input.id) {
    const updated = await db
      .update(offers)
      .set(values)
      .where(and(eq(offers.id, input.id), eq(offers.storeId, store.id)))
      .returning({ id: offers.id })
    if (!updated.length) return { error: 'العرض مش موجود' }
  } else {
    await db.insert(offers).values({ ...values, storeId: store.id })
  }

  revalidatePath('/dashboard/marketing')
  return { ok: true }
}

export async function toggleOfferAction(id: string, isActive: boolean): Promise<OfferState> {
  const { store } = await getDashboardContext()
  await db
    .update(offers)
    .set({ isActive })
    .where(and(eq(offers.id, id), eq(offers.storeId, store.id)))
  revalidatePath('/dashboard/marketing')
  return { ok: true }
}

export async function deleteOfferAction(id: string): Promise<OfferState> {
  const { store } = await getDashboardContext()
  await db.delete(offers).where(and(eq(offers.id, id), eq(offers.storeId, store.id)))
  revalidatePath('/dashboard/marketing')
  return { ok: true }
}
