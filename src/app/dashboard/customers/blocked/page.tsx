import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadBlocked } from '@/lib/blocked-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { BlockedManager } from './blocked-manager'

export const metadata = { title: 'الحظر' }

export default async function BlockedPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'orders.manage')

  const { rows, risky } = await loadBlocked(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الحظر ومنع الطلبات الوهمية"
        description="الدفع عند الاستلام معناه إنك بتشحن على أمل — والرقم الوهمي بيكلّفك شحن رايح وجاي في كل مرة."
      />

      <Reveal>
        <BlockedManager rows={rows} risky={risky} />
      </Reveal>
    </div>
  )
}
