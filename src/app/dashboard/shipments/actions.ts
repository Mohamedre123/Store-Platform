'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { orderEvents, orders, shipments } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { shipmentStatusMeta, type ShipmentStatus } from '@/lib/carriers'
import { updateOrderStatusAction } from '@/app/dashboard/orders/actions'

export type ShipmentState = { ok?: boolean; error?: string } | null

const createSchema = z.object({
  orderId: z.string().uuid(),
  carrier: z.string().min(1, 'اختار شركة الشحن'),
  trackingNumber: z.string().trim().max(60).optional(),
  /** بالجنيه من الواجهة — بنحوّله لقرش هنا */
  shippingCost: z.coerce.number().min(0).max(1_000_000).optional(),
  codAmount: z.coerce.number().min(0).max(10_000_000).optional(),
})

/**
 * تسجيل شحنة على طلب.
 *
 * رقم البوليصة بيتكتب كمان على الطلب نفسه مش على الشحنة بس: رسالة
 * «طلبك اتشحن» بتقراه من الطلب، ولو سبناه فاضي العميل ياخد رسالة
 * شحن من غير رقم يتابع بيه — وده بيرجّعه يسأل على واتساب.
 *
 * وبنغيّر حالة الطلب عن طريق دالة الطلبات نفسها لا بتحديث مباشر،
 * عشان الرسالة والويب هوك والأتمتة كلهم يشتغلوا زي أي تغيير حالة.
 */
export async function createShipmentAction(raw: unknown): Promise<ShipmentState> {
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user } = await getDashboardContext()

  const [order] = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, total: orders.total })
    .from(orders)
    .where(and(eq(orders.id, input.orderId), eq(orders.storeId, store.id)))
    .limit(1)

  if (!order) return { error: 'الطلب مش موجود' }

  const tracking = input.trackingNumber?.trim() || null

  await db.transaction(async (tx) => {
    await tx.insert(shipments).values({
      storeId: store.id,
      orderId: order.id,
      carrier: input.carrier,
      trackingNumber: tracking,
      status: 'created',
      shippingCost: input.shippingCost ? Math.round(input.shippingCost * 100) : 0,
      codAmount: input.codAmount ? Math.round(input.codAmount * 100) : 0,
      events: [{ at: new Date().toISOString(), status: 'created', note: 'الشحنة اتسجّلت' }],
    })

    await tx
      .update(orders)
      .set({ trackingNumber: tracking, shippingCarrier: input.carrier })
      .where(eq(orders.id, order.id))

    await tx.insert(orderEvents).values({
      orderId: order.id,
      storeId: store.id,
      type: 'note',
      message: tracking ? `اتسجّلت شحنة — بوليصة ${tracking}` : 'اتسجّلت شحنة',
      actorType: 'merchant',
      actorId: user.id,
    })
  })

  await updateOrderStatusAction(order.id, 'shipped')

  revalidatePath('/dashboard/shipments')
  revalidatePath(`/dashboard/orders/${order.id}`)
  return { ok: true }
}

/**
 * تحديث حالة الشحنة.
 *
 * كل تحديث بيتضاف لسجل الشحنة مش بيستبدل الحالة بس — التاجر بيحتاج
 * يعرف الشحنة فضلت قد إيه في كل مرحلة لما يقيّم شركة الشحن.
 *
 * التسليم والرجوع بيتنقلوا للطلب: من غير كده الطلب يفضل «اتشحن»
 * بعد ما العميل استلم، ونقاط الولاء وعمولة المسوّق ما تتصرفش.
 */
export async function updateShipmentStatusAction(
  id: string,
  status: ShipmentStatus,
  note?: string,
): Promise<ShipmentState> {
  const { store, user } = await getDashboardContext()

  const [row] = await db
    .select({ id: shipments.id, orderId: shipments.orderId, status: shipments.status })
    .from(shipments)
    .where(and(eq(shipments.id, id), eq(shipments.storeId, store.id)))
    .limit(1)

  if (!row) return { error: 'الشحنة مش موجودة' }
  if (row.status === status) return { ok: true }

  const event = { at: new Date().toISOString(), status, note: note?.trim() || undefined }

  await db.transaction(async (tx) => {
    await tx
      .update(shipments)
      .set({
        status,
        // الإضافة في SQL لا في الذاكرة: قراءة السجل وكتابته تاني كانت
        // هتضيّع أي حدث اتسجّل بينهم
        events: sql`${shipments.events} || ${JSON.stringify([event])}::jsonb`,
      })
      .where(eq(shipments.id, id))

    await tx.insert(orderEvents).values({
      orderId: row.orderId,
      storeId: store.id,
      type: 'status_changed',
      message: `الشحنة: ${shipmentStatusMeta(status).label}${note ? ` — ${note}` : ''}`,
      actorType: 'merchant',
      actorId: user.id,
    })
  })

  if (status === 'delivered') await updateOrderStatusAction(row.orderId, 'delivered')
  else if (status === 'returned') await updateOrderStatusAction(row.orderId, 'returned')

  revalidatePath('/dashboard/shipments')
  revalidatePath(`/dashboard/orders/${row.orderId}`)
  return { ok: true }
}

/**
 * تحصيل الدفع عند الاستلام.
 *
 * أهم رقم في المتاجر المصرية: كام فلوس لسه عند المندوبين. الشركة
 * بتسلّم المتحصّل كل أسبوع أو أسبوعين، والتاجر لازم يعرف يطالب بإيه —
 * من غير السجل ده بيبقى بيصدّق كشف الشركة على عماه.
 */
export async function settleCodAction(id: string, collected: boolean): Promise<ShipmentState> {
  const { store } = await getDashboardContext()

  const updated = await db
    .update(shipments)
    .set({ isCodCollected: collected, settledAt: collected ? new Date() : null })
    .where(and(eq(shipments.id, id), eq(shipments.storeId, store.id)))
    .returning({ id: shipments.id })

  if (!updated.length) return { error: 'الشحنة مش موجودة' }

  revalidatePath('/dashboard/shipments')
  return { ok: true }
}

export async function deleteShipmentAction(id: string): Promise<ShipmentState> {
  const { store } = await getDashboardContext()

  const deleted = await db
    .delete(shipments)
    .where(and(eq(shipments.id, id), eq(shipments.storeId, store.id)))
    .returning({ id: shipments.id })

  if (!deleted.length) return { error: 'الشحنة مش موجودة' }

  revalidatePath('/dashboard/shipments')
  return { ok: true }
}
