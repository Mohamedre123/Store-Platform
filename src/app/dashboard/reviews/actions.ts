'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { products, reviews } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'

export type ReviewActionState = { ok?: boolean; error?: string } | null

/**
 * اعتماد مراجعة أو رفضها.
 *
 * متوسط التقييم على المنتج بيتحدّث هنا مش عند الكتابة: المراجعة
 * غير المعتمدة ما تأثّرش على تقييم المنتج، وإلا حد يكتب سبام ويغيّر
 * تقييم المنتج قبل ما التاجر يشوفه أصلًا.
 */
export async function approveReviewAction(id: string, approve: boolean): Promise<ReviewActionState> {
  const { store } = await getDashboardContext()

  const [review] = await db
    .select({ id: reviews.id, productId: reviews.productId, rating: reviews.rating, isApproved: reviews.isApproved })
    .from(reviews)
    .where(and(eq(reviews.id, id), eq(reviews.storeId, store.id)))
    .limit(1)

  if (!review) return { error: 'المراجعة مش موجودة' }
  if (review.isApproved === approve) return { ok: true }

  const delta = approve ? 1 : -1

  await db.transaction(async (tx) => {
    await tx.update(reviews).set({ isApproved: approve }).where(eq(reviews.id, id))

    await tx
      .update(products)
      .set({
        ratingSum: sql`greatest(0, ${products.ratingSum} + ${delta * review.rating})`,
        ratingCount: sql`greatest(0, ${products.ratingCount} + ${delta})`,
      })
      .where(and(eq(products.id, review.productId), eq(products.storeId, store.id)))
  })

  revalidatePath('/dashboard/reviews')
  return { ok: true }
}

export async function deleteReviewAction(id: string): Promise<ReviewActionState> {
  const { store } = await getDashboardContext()

  const [review] = await db
    .select({ productId: reviews.productId, rating: reviews.rating, isApproved: reviews.isApproved })
    .from(reviews)
    .where(and(eq(reviews.id, id), eq(reviews.storeId, store.id)))
    .limit(1)

  if (!review) return { error: 'المراجعة مش موجودة' }

  await db.transaction(async (tx) => {
    await tx.delete(reviews).where(and(eq(reviews.id, id), eq(reviews.storeId, store.id)))

    // المعتمدة بس هي اللي محسوبة في التقييم، فدي اللي نطرحها
    if (review.isApproved) {
      await tx
        .update(products)
        .set({
          ratingSum: sql`greatest(0, ${products.ratingSum} - ${review.rating})`,
          ratingCount: sql`greatest(0, ${products.ratingCount} - 1)`,
        })
        .where(and(eq(products.id, review.productId), eq(products.storeId, store.id)))
    }
  })

  revalidatePath('/dashboard/reviews')
  return { ok: true }
}

/** رد التاجر على مراجعة — بيظهر تحتها في المتجر */
export async function replyToReviewAction(id: string, reply: string): Promise<ReviewActionState> {
  const { store } = await getDashboardContext()

  const updated = await db
    .update(reviews)
    .set({ merchantReply: reply.trim() || null })
    .where(and(eq(reviews.id, id), eq(reviews.storeId, store.id)))
    .returning({ id: reviews.id })

  if (!updated.length) return { error: 'المراجعة مش موجودة' }

  revalidatePath('/dashboard/reviews')
  return { ok: true }
}
