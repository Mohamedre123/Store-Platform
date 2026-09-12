import 'server-only'
import { and, asc, count, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { couriers, orderEvents, orderItems, orders, shipments } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import { ORDER_STATUSES } from '@/lib/order-status'
import { loadTrustScore, loadTrustScores } from '@/lib/trust-score'

/**
 * بيانات الطلبات — مصدر واحد لصفحات اللوحة وتطبيق الموبايل.
 *
 * نفس سبب `loadHomeData`: لو التطبيق كتب استعلاماته، أول تعديل على
 * تعريف «السلة المتروكة» أو ترتيب القايمة كان هيتعمل في مكان واحد،
 * والتاجر يلاقي طلب ظاهر على اللابتوب ومش ظاهر على الموبايل.
 */

export async function loadOrdersList(store: ActiveStore, filter: string | undefined) {
  const isIncomplete = filter === 'incomplete'
  const where = isIncomplete
    ? and(eq(orders.storeId, store.id), eq(orders.isIncomplete, true))
    : filter && filter !== 'all'
      ? and(eq(orders.storeId, store.id), eq(orders.status, filter as never))
      : and(eq(orders.storeId, store.id), eq(orders.isIncomplete, false))

  const [rows, counts] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        isIncomplete: orders.isIncomplete,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        customerEmail: orders.customerEmail,
        total: orders.total,
        createdAt: orders.createdAt,
        shippingAddress: orders.shippingAddress,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(100),

    db
      .select({ status: orders.status, isIncomplete: orders.isIncomplete, n: count() })
      .from(orders)
      .where(eq(orders.storeId, store.id))
      .groupBy(orders.status, orders.isIncomplete),
  ])

  /*
    درجات الثقة لكل أرقام الصفحة في استعلامين.

    التاجر بيمسح القايمة بعينه قبل ما يقرّر يشحن إيه — فالتحذير
    لازم يبقى هنا، مش جوّه كل طلب على حدة.
  */
  const trust = await loadTrustScores(
    store.id,
    rows.map((r) => r.customerPhone),
  )

  const incompleteCount = counts.find((c) => c.isIncomplete)?.n ?? 0
  const totalCount = counts.filter((c) => !c.isIncomplete).reduce((n, c) => n + c.n, 0)
  const countFor = (key: string) => counts.find((c) => !c.isIncomplete && c.status === key)?.n ?? 0

  const tabs = [
    { key: 'all', label: 'الكل', n: totalCount },
    ...ORDER_STATUSES.filter((s) => !['incomplete', 'returned'].includes(s.key)).map((s) => ({
      key: s.key,
      label: s.label,
      n: countFor(s.key),
    })),
  ]

  return { rows, trust, isIncomplete, incompleteCount, totalCount, tabs }
}

export async function loadOrderDetail(store: ActiveStore, orderId: string) {
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, store.id)))
    .limit(1)

  if (!order) return null

  const [items, events, courierOptions, assignedRows, trust] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(asc(orderEvents.createdAt)),
    /*
      المندوبون الشغّالين — عشان الإسناد يتم من صفحة الطلب مباشرةً.

      استعلامان خفيفان على جدول صغير. التاجر اللي بيشحن بشركة
      ما عندوش صفوف هنا، والكارت بيختفي عنده من غير أي إعداد.
    */
    db
      .select({
        id: couriers.id,
        name: couriers.name,
        phone: couriers.phone,
        zones: couriers.zones,
      })
      .from(couriers)
      .where(and(eq(couriers.storeId, store.id), eq(couriers.isActive, true)))
      .orderBy(couriers.name),
    db
      .select({ name: couriers.name, phone: couriers.phone })
      .from(shipments)
      .innerJoin(couriers, eq(couriers.id, shipments.courierId))
      .where(and(eq(shipments.storeId, store.id), eq(shipments.orderId, order.id)))
      .limit(1),
    /*
      درجة ثقة العميل — بتتحمّل مع الطلب لا بضغطة زيادة.

      استعلامين مجمّعين، والقرار اللي بتخدمه (أشحن ولا أتصل) بيتاخد
      في نفس الفتحة دي.
    */
    loadTrustScore(store.id, order.customerPhone),
  ])

  return { order, items, events, courierOptions, assigned: assignedRows[0] ?? null, trust }
}
