import 'server-only'
import { and, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders, shipments } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import { activeCarrier } from '@/lib/provider-store'
import { carrierProvider } from '@/lib/providers'
import type { PendingOrder, ShipmentRow } from '@/app/dashboard/shipments/shipments-manager'

/**
 * بيانات صفحة الشحنات — صفحة اللوحة و`/api/app/shipments` بيقروا من هنا.
 *
 * نفس الاستعلامات اللي كانت في الصفحة بالحرف.
 */
export async function loadShipments(store: ActiveStore) {
  /*
    الشركة المربوطة بربط تلقائي — اللي التاجر يقدر يبعتلها بضغطة.
    اليدوية مش بتتحسب هنا: زرار «ابعت» عليها كان هيفشل كل مرة.
  */
  const carrier = await activeCarrier(store.id)
  const autoCarrierName = carrier ? (carrierProvider(carrier.slug)?.name ?? null) : null

  const rows = (await db
    .select({
      id: shipments.id,
      carrier: shipments.carrier,
      trackingNumber: shipments.trackingNumber,
      status: shipments.status,
      codAmount: shipments.codAmount,
      shippingCost: shipments.shippingCost,
      isCodCollected: shipments.isCodCollected,
      settledAt: shipments.settledAt,
      events: shipments.events,
      createdAt: shipments.createdAt,
      orderId: shipments.orderId,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      // العنوان jsonb — بناخد المدينة منه بدل ما نجيب الكائن كله
      city: sql<string | null>`${orders.shippingAddress}->>'city'`,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(eq(shipments.storeId, store.id))
    .orderBy(desc(shipments.createdAt))
    .limit(300)) as ShipmentRow[]

  /**
   * الطلبات المستحقّة للشحن.
   *
   * الطلب المؤكّد اللي لسه مالوش شحنة هو أكتر حاجة بتتنسي في اليوم
   * المزحوم — والعميل بيبقى دافع ومستني. بنعرضهم فوق عشان التاجر
   * يشحنهم من هنا من غير ما يفتح كل طلب لوحده.
   */
  const shipped = db.select({ id: shipments.orderId }).from(shipments).where(eq(shipments.storeId, store.id))

  const pending = (await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      city: sql<string | null>`${orders.shippingAddress}->>'city'`,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(
      and(
        eq(orders.storeId, store.id),
        inArray(orders.status, ['confirmed', 'processing']),
        notInArray(orders.id, shipped),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(50)) as PendingOrder[]

  /**
   * الفلوس اللي لسه عند شركات الشحن.
   *
   * اتسلّمت + الدفع عند الاستلام + لسه ما اتحصّلش. ده الرقم اللي
   * التاجر بيطالب بيه الشركة، ومن غيره بيصدّق كشفها على عماه.
   */
  const [outstanding] = await db
    .select({
      amount: sql<number>`coalesce(sum(${shipments.codAmount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(shipments)
    .where(
      and(
        eq(shipments.storeId, store.id),
        eq(shipments.status, 'delivered'),
        eq(shipments.isCodCollected, false),
        isNull(shipments.settledAt),
      ),
    )

  return {
    autoCarrierName,
    rows,
    pending,
    outstandingAmount: Number(outstanding?.amount ?? 0),
    outstandingCount: Number(outstanding?.count ?? 0),
    inTransit: rows.filter((r) => !['delivered', 'failed', 'returned'].includes(r.status)).length,
    failed: rows.filter((r) => ['failed', 'returned'].includes(r.status)).length,
  }
}
