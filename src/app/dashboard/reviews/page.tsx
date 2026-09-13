import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadReviews } from '@/lib/reviews-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { ReviewsManager } from './reviews-manager'

export const metadata = { title: 'المراجعات' }

export default async function ReviewsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'customers.view')

  /* الاستعلام في `src/lib/reviews-data.ts` — تطبيق الموبايل بيقرا نفس البيانات */
  const { rows, waiting } = await loadReviews(store)

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
        <ReviewsManager reviews={rows} />
      </Reveal>
    </div>
  )
}
