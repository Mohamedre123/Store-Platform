'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, inArray, isNull } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { couriers, shipments } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { assignOrderToCourier, newCourierToken } from '@/lib/couriers'
import { normalizePhone } from '@/lib/utils'

export type CourierState = { ok?: boolean; error?: string; id?: string } | null

const schema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(2, 'اكتب اسم المندوب').max(80),
  phone: z.string().trim().min(6, 'اكتب رقم المندوب').max(24),
  vehicle: z.enum(['motorcycle', 'car', 'van', 'foot']),
  zones: z.array(z.string().trim().min(1).max(80)).max(60).default([]),
  /** بالقرش زي كل مبالغ المنصة */
  feePerOrder: z.coerce.number().int().min(0).max(100_000_000).default(0),
  note: z.string().trim().max(400).nullish(),
})

export async function saveCourierAction(raw: unknown): Promise<CourierState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'orders.manage')

  const values = {
    name: input.name,
    phone: normalizePhone(input.phone) ?? input.phone,
    vehicle: input.vehicle,
    zones: input.zones,
    feePerOrder: input.feePerOrder,
    note: input.note?.trim() || null,
    updatedAt: new Date(),
  }

  if (input.id) {
    const updated = await db
      .update(couriers)
      .set(values)
      .where(and(eq(couriers.id, input.id), eq(couriers.storeId, store.id)))
      .returning({ id: couriers.id })

    if (!updated.length) return { error: 'المندوب مش موجود' }
    revalidatePath('/dashboard/couriers')
    return { ok: true, id: updated[0].id }
  }

  const [created] = await db
    .insert(couriers)
    .values({ storeId: store.id, accessToken: newCourierToken(), ...values })
    .returning({ id: couriers.id })

  revalidatePath('/dashboard/couriers')
  return { ok: true, id: created.id }
}

/**
 * إيقاف المندوب — **لا حذف**.
 *
 * الشحنات اللي مشى بيها بتفضل مربوطة بيه، وحسابه المفتوح بيفضل
 * ظاهرًا. الحذف كان هيسيب شحنات بمندوب مش موجود، والتاجر يفضل
 * شايف فلوسًا مستحقّة من غير ما يعرف على مين.
 */
export async function toggleCourierAction(id: string, active: boolean): Promise<CourierState> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'orders.manage')

  const updated = await db
    .update(couriers)
    .set({ isActive: active, updatedAt: new Date() })
    .where(and(eq(couriers.id, id), eq(couriers.storeId, store.id)))
    .returning({ id: couriers.id })

  if (!updated.length) return { error: 'المندوب مش موجود' }
  revalidatePath('/dashboard/couriers')
  return { ok: true }
}

/**
 * توليد رمز جديد — الرابط القديم بيموت في نفس اللحظة.
 *
 * ده اللي التاجر بيعمله لما مندوب يمشي: الرابط اللي على موبايله
 * بقى بيفتح صفحة «الرابط ده مش شغّال»، وما بقاش يشوف أي عميل.
 */
export async function rotateCourierTokenAction(id: string): Promise<CourierState> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'orders.manage')

  const updated = await db
    .update(couriers)
    .set({ accessToken: newCourierToken(), updatedAt: new Date() })
    .where(and(eq(couriers.id, id), eq(couriers.storeId, store.id)))
    .returning({ id: couriers.id })

  if (!updated.length) return { error: 'المندوب مش موجود' }
  revalidatePath('/dashboard/couriers')
  return { ok: true }
}

/**
 * تسوية حساب المندوب — استلمت منه فلوسه وسلّمته أجرته.
 *
 * بيختم كل شحنة مفتوحة معاه بـ`settledAt` **في نفس اللحظة**، فالرقم
 * اللي التاجر شافه قبل الضغط هو نفسه اللي اتقفل. من غير الختم ده،
 * الفلوس المحصّلة كانت هتفضل ظاهرة «مستحقّة» للأبد والتاجر يحسبها
 * تاني كل يوم.
 */
export async function settleCourierAction(id: string): Promise<CourierState & { count?: number }> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'orders.manage')

  const [courier] = await db
    .select({ id: couriers.id })
    .from(couriers)
    .where(and(eq(couriers.id, id), eq(couriers.storeId, store.id)))
    .limit(1)

  if (!courier) return { error: 'المندوب مش موجود' }

  const settled = await db
    .update(shipments)
    .set({ settledAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(shipments.storeId, store.id),
        eq(shipments.courierId, id),
        isNull(shipments.settledAt),
        inArray(shipments.status, ['delivered', 'failed', 'returned']),
      ),
    )
    .returning({ id: shipments.id })

  revalidatePath('/dashboard/couriers')
  revalidatePath('/dashboard/shipments')
  return { ok: true, count: settled.length }
}

/** إسناد طلب لمندوب — بيتنادى من صفحة الطلب ومن صفحة الشحنات */
export async function assignCourierAction(orderId: string, courierId: string): Promise<CourierState> {
  const { store, actor, user } = await getDashboardContext()
  assertCan(actor, 'orders.manage')

  const res = await assignOrderToCourier(store.id, orderId, courierId, user.id)
  if (!res.ok) return { error: res.error }

  revalidatePath('/dashboard/couriers')
  revalidatePath('/dashboard/shipments')
  revalidatePath(`/dashboard/orders/${orderId}`)
  return { ok: true }
}
