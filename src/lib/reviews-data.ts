import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { products, reviews } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import type { ReviewRow } from '@/app/dashboard/reviews/reviews-manager'

/** بيانات صفحة المراجعات — صفحة اللوحة و`/api/app/reviews` بيقروا من هنا */
export async function loadReviews(store: ActiveStore) {
  const rows = (await db
    .select({
      id: reviews.id,
      authorName: reviews.authorName,
      rating: reviews.rating,
      body: reviews.body,
      isVerifiedPurchase: reviews.isVerifiedPurchase,
      isApproved: reviews.isApproved,
      merchantReply: reviews.merchantReply,
      createdAt: reviews.createdAt,
      productName: products.name,
    })
    .from(reviews)
    .leftJoin(products, eq(products.id, reviews.productId))
    .where(eq(reviews.storeId, store.id))
    .orderBy(desc(reviews.createdAt))
    .limit(200)) as ReviewRow[]

  return { rows, waiting: rows.filter((r) => !r.isApproved).length }
}
