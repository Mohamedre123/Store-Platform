import 'server-only'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { nanoid } from 'nanoid'
import { db } from '@/db'
import { couriers, orderEvents, orders, shipments } from '@/db/schema'
import type { CourierRow, CourierTask } from './couriers-meta'

/**
 * المندوبون — قراءة وحساب.
 *
 * الحتة دي مبنية **فوق جدول الشحنات** لا جنبه: المندوب بيتسند له
 * الطلب كشحنة `carrier = 'internal'` عليها `courierId`. يعني كل
 * الماكينة اللي شغّالة أصلًا — الحالات، ومبلغ الدفع عند الاستلام،
 * والتسوية، وصفحة الشحنات — بتشتغل عليه من غير أي سطر جديد.
 *
 * البديل (جدول توصيلات مستقل) كان معناه مسارين لنفس الحاجة: طلب
 * «متشحن» في مكان و«متوصّل» في مكان تاني، وأول تقرير بيجمع
 * الاتنين بيطلع رقمين مختلفين لنفس اليوم.
 */

export type { CourierRow, CourierTask, VehicleKey } from './couriers-meta'

/**
 * رمز صفحة المندوب.
 *
 * ٣٢ حرفًا: الرابط ده بيفتح أسماء عملاء وتليفوناتهم وعناوينهم من
 * غير أي كلمة سر، فطوله هو الحماية الوحيدة. `nanoid` بيقرا من
 * مولّد الأرقام العشوائية بتاع النظام لا من `Math.random`.
 */
export function newCourierToken(): string {
  return nanoid(32)
}

/**
 * المندوبون بحساباتهم.
 *
 * استعلامين لا استعلام لكل مندوب: المتجر اللي عنده عشر مندوبين
 * كان هيعمل واحد وعشرين رحلة لقاعدة البيانات في فتح الصفحة.
 */
export async function listCouriers(storeId: string): Promise<CourierRow[]> {
  const rows = await db
    .select()
    .from(couriers)
    .where(eq(couriers.storeId, storeId))
    .orderBy(desc(couriers.isActive), couriers.name)

  if (rows.length === 0) return []

  /*
    الحساب على الشحنات المسنودة، مجمّعة في استعلام واحد.

    `isCodCollected` مع `settledAt is null` هو تعريف «فلوس في جيب
    المندوب»: حصّلها من العميل وما سلّمهاش للتاجر لسه. ومن غير شرط
    التسوية، الرقم ده كان هيفضل بيكبر للأبد وما يفضّيش أبدًا.
  */
  const stats = await db
    .select({
      courierId: shipments.courierId,
      open: sql<number>`count(*) filter (where ${shipments.status} not in ('delivered','failed','returned'))::int`,
      delivered: sql<number>`count(*) filter (where ${shipments.status} = 'delivered')::int`,
      failed: sql<number>`count(*) filter (where ${shipments.status} in ('failed','returned'))::int`,
      due: sql<number>`coalesce(sum(${shipments.codAmount}) filter (where ${shipments.isCodCollected} and ${shipments.settledAt} is null), 0)::bigint`,
      fees: sql<number>`coalesce(sum(${shipments.shippingCost}) filter (where ${shipments.status} = 'delivered' and ${shipments.settledAt} is null), 0)::bigint`,
    })
    .from(shipments)
    .where(
      and(
        eq(shipments.storeId, storeId),
        inArray(
          shipments.courierId,
          rows.map((r) => r.id),
        ),
      ),
    )
    .groupBy(shipments.courierId)

  const byId = new Map(stats.map((s) => [s.courierId, s]))

  return rows.map((r): CourierRow => {
    const s = byId.get(r.id)
    return {
      id: r.id,
      name: r.name,
      phone: r.phone,
      vehicle: r.vehicle,
      zones: r.zones,
      feePerOrder: r.feePerOrder,
      accessToken: r.accessToken,
      isActive: r.isActive,
      note: r.note,
      openCount: Number(s?.open ?? 0),
      deliveredCount: Number(s?.delivered ?? 0),
      failedCount: Number(s?.failed ?? 0),
      dueAmount: Number(s?.due ?? 0),
      feesDue: Number(s?.fees ?? 0),
    }
  })
}

/**
 * قايمة شغل المندوب — اللي في إيده دلوقتي.
 *
 * **اللي في الطريق بس، ومعاه اللي وصّله النهاردة.** المندوب مش
 * محتاج يشوف تاريخ شهر على موبايله، ولو عرضناه كان لازم يفضل
 * ينزّل عشان يلاقي شغل يومه. واللي وصّله النهاردة بيفضل ظاهر عشان
 * لو دوس «اتسلّم» غلط يقدر يرجّعها.
 */
export async function courierTasks(courierId: string, storeId: string): Promise<CourierTask[]> {
  const rows = await db
    .select({
      shipmentId: shipments.id,
      status: shipments.status,
      codAmount: shipments.codAmount,
      isCodCollected: shipments.isCodCollected,
      createdAt: shipments.createdAt,
      orderId: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      notes: orders.notes,
      address: sql<string | null>`${orders.shippingAddress}->>'street'`,
      city: sql<string | null>`${orders.shippingAddress}->>'city'`,
      items: sql<string>`(
        select coalesce(string_agg(oi.name || ' ×' || oi.quantity, '، '), '')
        from order_items oi where oi.order_id = ${orders.id}
      )`,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(
      and(
        eq(shipments.storeId, storeId),
        eq(shipments.courierId, courierId),
        sql`(${shipments.status} not in ('delivered','failed','returned') or ${shipments.updatedAt} >= now() - interval '18 hours')`,
      ),
    )
    .orderBy(shipments.status, desc(shipments.createdAt))
    .limit(120)

  return rows.map(
    (r): CourierTask => ({
      shipmentId: r.shipmentId,
      status: r.status,
      orderId: r.orderId,
      orderNumber: r.orderNumber,
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      address: r.address,
      city: r.city,
      codAmount: r.codAmount,
      isCodCollected: r.isCodCollected,
      notes: r.notes,
      itemsSummary: r.items,
      createdAt: r.createdAt.toISOString(),
    }),
  )
}

/** المندوب من رمزه — بيرجّع null لو الرمز غلط أو الحساب متوقّف */
export async function courierByToken(token: string) {
  if (!token || token.length < 16) return null
  const [row] = await db.select().from(couriers).where(eq(couriers.accessToken, token)).limit(1)
  if (!row || !row.isActive) return null
  return row
}

/**
 * إسناد طلب لمندوب.
 *
 * بيعمل شحنة `internal` لو الطلب مالوش شحنة، ولو عنده واحدة
 * بيحوّلها له. الأجرة بتتكتب على الشحنة وقت الإسناد لا بتتقرا من
 * المندوب وقت الحساب: التاجر اللي زوّد الأجرة الشهر ده مالوش دعوة
 * إن توصيلات الشهر اللي فات تتحسب بالسعر الجديد.
 */
export async function assignOrderToCourier(
  storeId: string,
  orderId: string,
  courierId: string,
  actorId: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const [courier] = await db
    .select()
    .from(couriers)
    .where(and(eq(couriers.id, courierId), eq(couriers.storeId, storeId)))
    .limit(1)

  if (!courier) return { ok: false, error: 'المندوب مش موجود' }
  if (!courier.isActive) return { ok: false, error: 'المندوب ده متوقّف' }

  const [order] = await db
    .select({
      id: orders.id,
      total: orders.total,
      orderNumber: orders.orderNumber,
      paymentStatus: orders.paymentStatus,
      depositPaid: orders.depositPaid,
    })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
    .limit(1)

  if (!order) return { ok: false, error: 'الطلب مش موجود' }

  /*
    اللي المندوب هيحصّله = الإجمالي − العربون، وصفر لو الطلب مدفوع.

    من غير طرح العربون، المندوب بيطلب من العميل مبلغًا هو دفع نُصّه
    على الإنترنت — والعميل بيرفض الاستلام، والتاجر بيخسر الطلب
    وأجرة التوصيل.
  */
  const cod = order.paymentStatus === 'paid' ? 0 : Math.max(0, order.total - order.depositPaid)

  const [existing] = await db
    .select({ id: shipments.id })
    .from(shipments)
    .where(and(eq(shipments.storeId, storeId), eq(shipments.orderId, orderId)))
    .limit(1)

  if (existing) {
    await db
      .update(shipments)
      .set({
        carrier: 'internal',
        courierId,
        codAmount: cod,
        shippingCost: courier.feePerOrder,
        updatedAt: new Date(),
      })
      .where(eq(shipments.id, existing.id))
  } else {
    await db.insert(shipments).values({
      storeId,
      orderId,
      carrier: 'internal',
      courierId,
      status: 'out_for_delivery',
      codAmount: cod,
      shippingCost: courier.feePerOrder,
    })
  }

  await db.insert(orderEvents).values({
    orderId,
    storeId,
    type: 'shipment',
    message: `الطلب اتسند للمندوب ${courier.name}`,
    actorType: 'merchant',
    actorId: actorId ?? undefined,
  })

  return { ok: true }
}
