'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { bookings, stores } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { DEFAULT_HOURS, type BookingStatus } from '@/lib/bookings'

export type BookingState = { ok?: boolean; error?: string } | null

const STATUSES: BookingStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show']

export async function setBookingStatusAction(
  id: string,
  status: string,
): Promise<BookingState> {
  if (!STATUSES.includes(status as BookingStatus)) return { error: 'حالة غير معروفة' }

  const { store } = await getDashboardContext()

  const updated = await db
    .update(bookings)
    .set({ status: status as BookingStatus })
    .where(and(eq(bookings.id, id), eq(bookings.storeId, store.id)))
    .returning({ id: bookings.id })

  if (!updated.length) return { error: 'الحجز مش موجود' }

  revalidatePath('/dashboard/bookings')
  return { ok: true }
}

const hoursSchema = z.object({
  enabled: z.boolean(),
  days: z.array(z.number().int().min(0).max(6)),
  from: z.string().regex(/^\d{1,2}:\d{2}$/, 'صيغة الوقت لازم تكون HH:MM'),
  to: z.string().regex(/^\d{1,2}:\d{2}$/, 'صيغة الوقت لازم تكون HH:MM'),
  slotMinutes: z.coerce.number().int().min(15).max(480),
})

/**
 * حفظ مواعيد العمل.
 *
 * **بنرفض «من» بعد «لحد».** الفترة المقلوبة بتخلّي حساب المواعيد
 * يرجّع قايمة فاضية، والتاجر بيبص على متجره ويلاقي «مفيش مواعيد»
 * من غير ما يعرف إن السبب رقمين مقلوبين.
 */
export async function saveBookingHoursAction(raw: unknown): Promise<BookingState> {
  const parsed = hoursSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }

  const { store } = await getDashboardContext()
  const { enabled, ...hours } = parsed.data

  const toMinutes = (v: string) => {
    const [h, m] = v.split(':').map(Number)
    return h * 60 + m
  }

  if (toMinutes(hours.to) <= toMinutes(hours.from)) {
    return { error: 'ساعة القفل لازم تكون بعد ساعة الفتح' }
  }

  if (enabled && hours.days.length === 0) {
    return { error: 'اختار يوم واحد على الأقل' }
  }

  await db
    .update(stores)
    .set({ bookingsEnabled: enabled, bookingHours: { ...DEFAULT_HOURS, ...hours } })
    .where(eq(stores.id, store.id))

  revalidatePath('/dashboard/bookings')
  return { ok: true }
}
