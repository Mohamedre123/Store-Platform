import { getDashboardContext } from '@/lib/store-context'
import { eligibleCount, readConnections } from '@/lib/marketplace'
import { platformOrigin } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { MarketplaceManager } from './marketplace-manager'

export const metadata = { title: 'ربط الكتالوج' }

export default async function MarketplacePage() {
  const { store } = await getDashboardContext()

  const [connections, counts] = await Promise.all([
    readConnections(store.id),
    eligibleCount(store.id),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="ربط الكتالوج"
        description="منتجاتك في إعلانات ميتا وجوجل وتيك توك — وبتتحدّث لوحدها."
      />

      <Reveal>
        <MarketplaceManager
          connections={connections}
          origin={platformOrigin()}
          storeId={store.id}
          counts={counts}
        />
      </Reveal>
    </div>
  )
}
