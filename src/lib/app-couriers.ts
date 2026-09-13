import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadCouriers } from '@/lib/couriers-data'
import { VEHICLES, vehicleLabel } from '@/lib/couriers-meta'
import { platformOrigin } from '@/lib/domain'
import { formatOrderNumber } from '@/lib/order-number'

/**
 * شكل شاشة المندوبين اللي تطبيق الموبايل بيستلمه.
 *
 * المبالغ بالوحدة الصغرى زي باقي المنصة. رمز المندوب ما بيتبعتش لوحده —
 * بيتبعت جوّه رابطه بس (نفس اللي اللوحة بتعرضه للتاجر).
 */
export async function couriersPayload(store: ActiveStore) {
  const { rows, cities, waiting } = await loadCouriers(store.id)
  const origin = platformOrigin()

  return {
    currency: store.currency,
    vehicles: VEHICLES,
    cities,
    stats: {
      active: rows.filter((r) => r.isActive).length,
      open: rows.reduce((s, r) => s + r.openCount, 0),
      waiting: waiting.length,
      due: rows.reduce((s, r) => s + r.dueAmount, 0),
    },
    waiting: waiting.map((o) => ({ ...o, orderLabel: formatOrderNumber(store, o.orderNumber) })),
    couriers: rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      vehicle: r.vehicle,
      vehicleLabel: vehicleLabel(r.vehicle),
      zones: r.zones,
      feePerOrder: r.feePerOrder,
      isActive: r.isActive,
      note: r.note,
      openCount: r.openCount,
      deliveredCount: r.deliveredCount,
      failedCount: r.failedCount,
      dueAmount: r.dueAmount,
      feesDue: r.feesDue,
      link: `${origin}/mandoub/${r.accessToken}`,
    })),
  }
}
