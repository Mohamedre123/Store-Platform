import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadCouriers } from '@/lib/couriers-data'
import { platformOrigin } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { CouriersManager } from './couriers-manager'

export const metadata = { title: 'المندوبون' }

export default async function CouriersPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'orders.manage')

  const { rows, cities, waiting } = await loadCouriers(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المندوبون"
        description="مندوبك بتاعك — مش شركة شحن. تسنده الطلبات، وتبعتله رابط يشوف بيه شغل يومه من موبايله، وتقفل حسابه آخر اليوم."
      />

      <Reveal>
        <CouriersManager
          rows={rows}
          cities={cities}
          currency={store.currency}
          origin={platformOrigin()}
          waiting={waiting}
        />
      </Reveal>
    </div>
  )
}
