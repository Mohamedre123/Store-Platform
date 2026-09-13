import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadBookings } from '@/lib/bookings-data'
import { BOOKING_STATUSES, DAY_NAMES, DEFAULT_HOURS, bookingStatusMeta } from '@/lib/bookings-meta'
import { formatOrderNumber } from '@/lib/order-number'

/**
 * شكل شاشة الحجوزات اللي تطبيق الموبايل بيستلمه.
 *
 * المواعيد ISO — الموبايل بيعرضها بتوقيته زي ما صفحة اللوحة بتعرضها
 * بتوقيت المتصفح.
 */
export async function bookingsPayload(store: ActiveStore) {
  const rows = await loadBookings(store.id)
  return {
    enabled: store.bookingsEnabled,
    hours: { ...DEFAULT_HOURS, ...(store.bookingHours ?? {}) },
    dayNames: DAY_NAMES,
    statuses: BOOKING_STATUSES.map((s) => ({ key: s.key, label: s.label, bg: s.bg, fg: s.fg })),
    bookings: rows.map((b) => {
      const meta = bookingStatusMeta(b.status)
      return {
        id: b.id,
        productName: b.productName,
        customerName: b.customerName,
        customerPhone: b.customerPhone,
        startsAt: b.startsAt.toISOString(),
        endsAt: b.endsAt.toISOString(),
        status: b.status,
        statusLabel: meta.label,
        bg: meta.bg,
        fg: meta.fg,
        notes: b.notes,
        orderLabel: b.orderNumber ? formatOrderNumber(store, b.orderNumber) : null,
      }
    }),
  }
}
