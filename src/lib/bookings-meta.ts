/**
 * ثوابت الحجوزات المشتركة بين الخادم والمتصفح.
 *
 * منفصلة عن `bookings.ts` لأن ده `server-only`: شاشة التاجر
 * وتقويم المتجر الاتنين لازمهم أسماء الأيام وحالات الحجز، ولو
 * قروهم من ملف الخادم كان البناء بيقع — نفس فصل `providers.ts`
 * عن `provider-store.ts`.
 */

export type BookingHours = {
  /** أيام الأسبوع: 0 الأحد … 6 السبت */
  days: number[]
  from: string
  to: string
  slotMinutes: number
}

export const DEFAULT_HOURS: BookingHours = {
  days: [6, 0, 1, 2, 3, 4],
  from: '10:00',
  to: '22:00',
  slotMinutes: 60,
}

export const DAY_NAMES = ['الأحد', 'الاتنين', 'التلات', 'الأربع', 'الخميس', 'الجمعة', 'السبت']

export type Slot = {
  /** ISO كامل — بيتبعت مع الطلب زي ما هو */
  startsAt: string
  endsAt: string
  label: string
  available: boolean
}

export const BOOKING_STATUSES = [
  { key: 'pending', label: 'مستنّي تأكيد', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  { key: 'confirmed', label: 'مؤكّد', bg: 'var(--color-info-soft)', fg: 'var(--color-info)' },
  { key: 'completed', label: 'تم', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  { key: 'cancelled', label: 'ملغي', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
  { key: 'no_show', label: 'ما جاش', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
] as const

export type BookingStatus = (typeof BOOKING_STATUSES)[number]['key']

export function bookingStatusMeta(status: string) {
  return BOOKING_STATUSES.find((s) => s.key === status) ?? BOOKING_STATUSES[0]
}
