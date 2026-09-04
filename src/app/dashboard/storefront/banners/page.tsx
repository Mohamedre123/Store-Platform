import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { banners } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { BannersManager, type BannerRow } from './banners-manager'

export const metadata = { title: 'البانرات' }

export default async function BannersPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'storefront.manage')

  const rows = await db
    .select()
    .from(banners)
    .where(eq(banners.storeId, store.id))
    .orderBy(desc(banners.createdAt))
    .limit(100)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="البانرات"
        description="شرائط ترويجية بتظهر في متجرك — وبتختفي لوحدها لما العرض ينتهي."
      />

      <Reveal>
        <BannersManager banners={rows as BannerRow[]} />
      </Reveal>
    </div>
  )
}
