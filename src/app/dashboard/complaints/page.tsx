import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { listTickets } from '@/lib/tickets'
import { formatOrderNumber } from '@/lib/order-number'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { ComplaintsManager } from './complaints-manager'

export const metadata = { title: 'الشكاوى' }

export default async function ComplaintsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'orders.view')

  const rows = await listTickets(store.id)
  const canReply = actor.role === 'owner' || actor.permissions.includes('orders.manage')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الشكاوى"
        description="اللي عميلك مضايق منه، في مكان واحد بدل ما يضيع وسط رسايل واتساب. اللي مستني ردّك فوق."
      />

      <Reveal>
        <ComplaintsManager
          rows={rows.map((r) => ({
            ...r,
            /* الرقم بتنسيق التاجر — نفس الرقم اللي على الفاتورة */
            orderLabel: r.orderNumber ? formatOrderNumber(store, r.orderNumber) : null,
          }))}
          canReply={canReply}
        />
      </Reveal>
    </div>
  )
}
