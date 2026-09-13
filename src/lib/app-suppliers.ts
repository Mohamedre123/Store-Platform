import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadSuppliers } from '@/lib/suppliers-data'

/**
 * شكل شاشة الموردين اللي تطبيق الموبايل بيستلمه.
 *
 * «محتاج تطلبه» متجمّع على المورّد هنا (زي اللوحة): اللي ليهم مورّد الأول،
 * واللي من غير مورّد آخر مجموعة.
 */
export async function suppliersPayload(store: ActiveStore) {
  const { rows, reorder, allProducts, unlinkedCount } = await loadSuppliers(store.id)
  const byId = new Map(rows.map((s) => [s.id, s]))

  const groups = new Map<string, { supplierId: string | null; name: string | null; phone: string | null; items: typeof reorder }>()
  for (const item of reorder) {
    const key = item.supplierId && byId.has(item.supplierId) ? item.supplierId : '—'
    if (!groups.has(key)) {
      const s = key === '—' ? null : byId.get(key)!
      groups.set(key, { supplierId: s?.id ?? null, name: s?.name ?? null, phone: s?.phone ?? null, items: [] })
    }
    groups.get(key)!.items.push(item)
  }

  return {
    currency: store.currency,
    unlinkedCount,
    reorderCount: reorder.length,
    reorder: [...groups.values()]
      .sort((a, b) => Number(a.supplierId === null) - Number(b.supplierId === null))
      .map((g) => ({
        ...g,
        items: g.items.map((p) => ({ id: p.id, name: p.name, sku: p.sku, stock: p.stock, costPrice: p.costPrice })),
      })),
    suppliers: rows.map((s) => ({
      id: s.id,
      name: s.name,
      phone: s.phone,
      email: s.email,
      marginPercent: s.defaultMarginBps / 100,
      isActive: s.isActive,
      productCount: allProducts.filter((p) => p.supplierId === s.id).length,
    })),
    products: allProducts,
  }
}
