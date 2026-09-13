import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { DEFAULT_HOURS } from '@/lib/bookings'
import { loadBookings } from '@/lib/bookings-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { BookingsManager, type BookingRow } from './bookings-manager'

export const metadata = { title: 'الحجوزات' }

export default async function BookingsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'orders.view')

  const rows = await loadBookings(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الحجوزات"
        description="مواعيد عملائك، ومواعيد شغلك اللي بتتحسب منها."
      />

      <Reveal>
        <BookingsManager
          bookings={rows as BookingRow[]}
          hours={{ ...DEFAULT_HOURS, ...(store.bookingHours ?? {}) }}
          enabled={store.bookingsEnabled}
        />
      </Reveal>
    </div>
  )
}
