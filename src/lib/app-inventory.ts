import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadInventory, MOVEMENT_REASONS } from '@/lib/inventory-data'
import { formatMoney } from '@/lib/utils'

/** شكل المخزون اللي تطبيق الموبايل بيستلمه — الكميات أرقام، والتواريخ ISO */
export async function inventoryPayload(store: ActiveStore) {
  const data = await loadInventory(store)

  return {
    currency: store.currency,
    stats: {
      units: data.units,
      valueLabel: formatMoney(data.value, store.currency),
      out: data.outCount,
      low: data.lowCount,
    },
    items: data.items.map((p) => ({
      id: p.id,
      name: p.name,
      sku: p.sku,
      image: p.images[0] ?? null,
      stock: p.stock,
      threshold: p.threshold,
      variants: p.variants.map((v) => ({ id: v.id, title: v.title, sku: v.sku, stock: v.stock })),
    })),
    movements: data.movements.slice(0, 25).map((m) => ({
      id: m.id,
      delta: m.delta,
      reasonLabel: MOVEMENT_REASONS[m.reason] ?? m.reason,
      note: m.note,
      productName: m.productName ?? 'منتج متشال',
      createdAt: new Date(m.createdAt).toISOString(),
    })),
  }
}
