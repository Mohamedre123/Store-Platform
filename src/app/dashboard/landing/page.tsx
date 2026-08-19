import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { funnels, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { storeUrl } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { LandingList, type FunnelRow } from './landing-list'

export const metadata = { title: 'صفحات الهبوط' }

export default async function LandingPage() {
  const { store } = await getDashboardContext()

  const [rows, productRows] = await Promise.all([
    db
      .select({
        id: funnels.id,
        name: funnels.name,
        slug: funnels.slug,
        status: funnels.status,
        views: funnels.views,
        conversions: funnels.conversions,
        createdAt: funnels.createdAt,
      })
      .from(funnels)
      .where(eq(funnels.storeId, store.id))
      .orderBy(desc(funnels.createdAt))
      .limit(100),
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.storeId, store.id), eq(products.status, 'active')))
      .orderBy(products.name)
      .limit(300),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="صفحات الهبوط"
        description="صفحة لكل حملة — بهويتها الخاصة المستقلة عن شكل متجرك."
      />

      <Reveal>
        <LandingList
          funnels={rows as FunnelRow[]}
          products={productRows}
          storeUrl={storeUrl(store.slug)}
        />
      </Reveal>
    </div>
  )
}
