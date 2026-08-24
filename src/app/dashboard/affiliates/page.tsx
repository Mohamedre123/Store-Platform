import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { affiliates } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { publicStoreUrl } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { AffiliatesManager, type AffiliateRow } from './affiliates-manager'

export const metadata = { title: 'المسوّقون بالعمولة' }

export default async function AffiliatesPage() {
  const { store } = await getDashboardContext()

  const rows = await db
    .select()
    .from(affiliates)
    .where(eq(affiliates.storeId, store.id))
    .orderBy(desc(affiliates.createdAt))
    .limit(200)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المسوّقون بالعمولة"
        description="ادّي كود لكل مسوّق — وكل بيعة تيجي من رابطه تتحسبله تلقائيًا."
      />

      <Reveal>
        <AffiliatesManager
          affiliates={rows as AffiliateRow[]}
          currency={store.currency}
          storeUrl={publicStoreUrl(store)}
        />
      </Reveal>
    </div>
  )
}
