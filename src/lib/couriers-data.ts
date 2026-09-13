import 'server-only'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, shipments, shippingRates } from '@/db/schema'
import { listCouriers } from '@/lib/couriers'

/**
 * بيانات شاشة المندوبين — صفحة اللوحة (`/dashboard/couriers`) وتطبيق
 * الموبايل (`/api/app/couriers`) الاتنين بيقروا من هنا.
 */
export async function loadCouriers(storeId: string) {
  const [rows, cities, waiting] = await Promise.all([
    listCouriers(storeId),

    /* مدن المتجر — عشان اختيار مناطق المندوب يبقى من نفس القايمة */
    db
      .selectDistinct({ city: shippingRates.city })
      .from(shippingRates)
      .where(eq(shippingRates.storeId, storeId))
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
          eq(orders.storeId, storeId),
          eq(orders.isIncomplete, false),
          isNull(shipments.id),
          sql`${orders.status} in ('confirmed','processing','ready')`,
        ),
      )
      .orderBy(desc(orders.createdAt))
      .limit(60),
  ])

  return {
    rows,
    cities: cities.map((c) => c.city),
    waiting: waiting.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerName: o.customerName,
      total: o.total,
      isPaid: o.paymentStatus === 'paid',
      city: o.city,
      createdAt: o.createdAt.toISOString(),
    })),
  }
}
