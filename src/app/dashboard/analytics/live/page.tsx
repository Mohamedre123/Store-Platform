import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { liveSnapshot } from '@/lib/live-view'
import { PageHeader } from '@/components/dashboard/page-shell'
import { LiveBoard } from './live-board'

export const metadata = { title: 'العرض المباشر' }

/**
 * `force-dynamic` مقصود: الشاشة معناها كله «دلوقتي».
 * أي تخزين ولو لثانية بيخلّيها تكدب.
 */
export const dynamic = 'force-dynamic'

export default async function LiveViewPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'reports.view')

  const snapshot = await liveSnapshot(store.id)
  /* الأرقام المالية للي عنده صلاحية الفلوس بس — زي باقي التقارير */
  const canSeeMoney = actor.role === 'owner' || actor.permissions.includes('finance.view')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="العرض المباشر"
        description="مين على متجرك دلوقتي وبيعمل إيه. الشاشة دي بتتحدّث لوحدها كل ١٥ ثانية."
      />

      <LiveBoard initial={snapshot} currency={store.currency} showMoney={canSeeMoney} />
    </div>
  )
}
