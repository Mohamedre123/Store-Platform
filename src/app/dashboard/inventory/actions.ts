'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { inventoryMovements, products, productVariants } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'

export type InventoryState = { ok?: boolean; error?: string; stock?: number } | null

/**
 * تعديل المخزون يدويًا.
 *
 * التاجر بيكتب **الكمية الجديدة** لأنه بيعدّ اللي في المخزن، مش بيحسب
 * الفرق. الفرق بنحسبه إحنا ونسجّله كحركة، عشان سؤال «المخزون راح فين؟»
 * يفضل ليه إجابة.
 *
 * التعديل والحركة في معاملة واحدة: لو الحركة فشلت، الكمية ما تتغيّرش —
 * مخزون بيتغيّر من غير أثر أسوأ من مخزون غلط، لأنه بيبان صح وهو غلط.
 */
export async function setStockAction(input: {
  kind: 'product' | 'variant'
  id: string
  stock: number
  note?: string
}): Promise<InventoryState> {
  const { store, user } = await getDashboardContext()

  const next = Math.trunc(input.stock)
  if (!Number.isFinite(next) || next < 0) return { error: 'الكمية لازم تكون رقمًا موجبًا' }

  const note = input.note?.trim().slice(0, 300) || null

  if (input.kind === 'variant') {
    const [row] = await db
      .select({ stock: productVariants.stock, productId: productVariants.productId })
      .from(productVariants)
      .where(and(eq(productVariants.id, input.id), eq(productVariants.storeId, store.id)))
      .limit(1)

    if (!row) return { error: 'المتغيّر مش موجود' }
    if (row.stock === next) return { ok: true, stock: next }

    await db.transaction(async (tx) => {
      await tx.update(productVariants).set({ stock: next }).where(eq(productVariants.id, input.id))
      await tx.insert(inventoryMovements).values({
        storeId: store.id,
        productId: row.productId,
        variantId: input.id,
        delta: next - row.stock,
        reason: 'manual',
        note,
        createdBy: user.id,
      })
    })
  } else {
    const [row] = await db
      .select({ stock: products.stock })
      .from(products)
      .where(and(eq(products.id, input.id), eq(products.storeId, store.id)))
      .limit(1)

    if (!row) return { error: 'المنتج مش موجود' }
    if (row.stock === next) return { ok: true, stock: next }

    await db.transaction(async (tx) => {
      await tx.update(products).set({ stock: next }).where(eq(products.id, input.id))
      await tx.insert(inventoryMovements).values({
        storeId: store.id,
        productId: input.id,
        delta: next - row.stock,
        reason: 'manual',
        note,
        createdBy: user.id,
      })
    })
  }

  revalidatePath('/dashboard/inventory')
  return { ok: true, stock: next }
}

/** حد التنبيه لكل منتج — التاجر اللي بيبيع ١٠٠٠ في اليوم مش زي اللي بيبيع ٥ */
export async function setLowStockThresholdAction(
  productId: string,
  threshold: number,
): Promise<InventoryState> {
  const { store } = await getDashboardContext()

  const value = Math.max(0, Math.trunc(threshold))
  if (!Number.isFinite(value)) return { error: 'الحد لازم يكون رقمًا' }

  const updated = await db
    .update(products)
    .set({ lowStockThreshold: value })
    .where(and(eq(products.id, productId), eq(products.storeId, store.id)))
    .returning({ id: products.id })

  if (!updated.length) return { error: 'المنتج مش موجود' }

  revalidatePath('/dashboard/inventory')
  return { ok: true }
}
