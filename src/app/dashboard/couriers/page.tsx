import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, shipments, shippingRates } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { listCouriers } from '@/lib/couriers'
import { platformOrigin } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { CouriersManager, type UnassignedOrder } from './couriers-manager'

export const metadata = { title: 'المندوبون' }

export default async function CouriersPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'orders.manage')

  const [rows, cities, waiting] = await Promise.all([
    listCouriers(store.id),

    /* مدن المتجر — عشان اختيار مناطق المندوب يبقى من نفس القايمة */
    db
      .selectDistinct({ city: shippingRates.city })
      .from(shippingRates)
      .where(eq(shippingRates.storeId, store.id))
      .orderBy(shippingRates.city)
      .limit(120),

    /**
     * الطلبات المؤكّدة اللي لسه محدّش ماشي بيها.
     *
     * دي الشاشة اللي التاجر بيفتحها الصبح: مين هيخرج بإيه النهاردة.
     * لو عرضناها في صفحة تانية، كان لازم يفتح شاشتين ويقارن بينهم
     * بعينه — وده اللي بيخلّي طلبًا يفضل في المخزن يومين.
     */
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        customerName: orders.customerName,
        total: orders.total,
        paymentStatus: orders.paymentStatus,
        city: sql<string | null>`${orders.shippingAddress}->>'city'`,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .leftJoin(shipments, eq(shipments.orderId, orders.id))
      .where(
        and(
          eq(orders.storeId, store.id),
          eq(orders.isIncomplete, false),
          isNull(shipments.id),
          sql`${orders.status} in ('confirmed','processing','ready')`,
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(60),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المندوبون"
        description="مندوبك بتاعك — مش شركة شحن. تسنده الطلبات، وتبعتله رابط يشوف بيه شغل يومه من موبايله، وتقفل حسابه آخر اليوم."
      />

      <Reveal>
        <CouriersManager
          rows={rows}
          cities={cities.map((c) => c.city)}
          currency={store.currency}
          origin={platformOrigin()}
          waiting={waiting.map(
            (o): UnassignedOrder => ({
              id: o.id,
              orderNumber: o.orderNumber,
              customerName: o.customerName,
              total: o.total,
              isPaid: o.paymentStatus === 'paid',
              city: o.city,
              createdAt: o.createdAt.toISOString(),
            }),
          )}
        />
      </Reveal>
    </div>
  )
}
