import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadReviews } from '@/lib/reviews-data'

/** شكل المراجعات اللي تطبيق الموبايل بيستلمه */
export async function reviewsPayload(store: ActiveStore) {
  const { rows, waiting } = await loadReviews(store)
  return {
    waiting,
    reviews: rows.map((r) => ({
      id: r.id,
      authorName: r.authorName,
      rating: r.rating,
      body: r.body,
      verified: r.isVerifiedPurchase,
      approved: r.isApproved,
      reply: r.merchantReply,
      productName: r.productName,
      createdAt: new Date(r.createdAt).toISOString(),
    })),
  }
}
