import 'server-only'
import { asc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { bookings, orders, products } from '@/db/schema'

/**
 * بيانات شاشة الحجوزات — صفحة اللوحة (`/dashboard/bookings`) وتطبيق
 * الموبايل (`/api/app/bookings`) الاتنين بيقروا من هنا.
 */
export async function loadBookings(storeId: string) {
  return db
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
    .where(eq(bookings.storeId, storeId))
    .orderBy(asc(bookings.startsAt))
    .limit(200)
}
