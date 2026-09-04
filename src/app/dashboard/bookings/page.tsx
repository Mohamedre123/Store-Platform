import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { bookings, orders, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { DEFAULT_HOURS } from '@/lib/bookings'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { BookingsManager, type BookingRow } from './bookings-manager'

export const metadata = { title: 'الحجوزات' }

export default async function BookingsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'orders.view')

  const rows = await db
    .select({
      id: bookings.id,
      productName: products.name,
      customerName: bookings.customerName,
      customerPhone: bookings.customerPhone,
      startsAt: bookings.startsAt,
      endsAt: bookings.endsAt,
      status: bookings.status,
      notes: bookings.notes,
      orderNumber: orders.orderNumber,
    })
    .from(bookings)
    .leftJoin(products, eq(products.id, bookings.productId))
    .leftJoin(orders, eq(orders.id, bookings.orderId))
    .where(eq(bookings.storeId, store.id))
    .orderBy(asc(bookings.startsAt))
    .limit(200)

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
