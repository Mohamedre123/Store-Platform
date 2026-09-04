import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { products, reviews } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { ReviewsManager, type ReviewRow } from './reviews-manager'

export const metadata = { title: 'المراجعات' }

export default async function ReviewsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'customers.view')

  const rows = await db
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
    .limit(200)

  const waiting = rows.filter((r) => !r.isApproved).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المراجعات"
        description={
          waiting > 0
            ? `${waiting} مراجعة مستنية موافقتك عشان تظهر في متجرك.`
            : 'آراء عملائك على منتجاتك. المراجعة ما بتظهرش للعملاء غير بعد ما توافق.'
        }
      />

      <Reveal>
        <ReviewsManager reviews={rows as ReviewRow[]} />
      </Reveal>
    </div>
  )
}
