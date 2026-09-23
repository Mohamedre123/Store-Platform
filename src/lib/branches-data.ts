import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { products } from '@/db/schema'
import { defaultBranch, levelsForProducts, listBranches } from '@/lib/branches'
import type { BranchProduct } from '@/app/dashboard/inventory/branches-manager'

/**
 * الفروع وتوزيع المخزون — صفحة اللوحة ومسار التطبيق (`/api/app/branches`) بيقروا من هنا.
 *
 * الفرع الافتراضي بيتعمل لوحده في أول زيارة: التاجر اللي عنده مكان واحد ما ينفعش
 * نطلب منه يعرّفه قبل ما يشوف أي حاجة.
 */
export async function loadBranchesPage(storeId: string) {
  await defaultBranch(storeId)
  const branches = await listBranches(storeId)

  const rows = await db
    .select({ id: products.id, name: products.name, stock: products.stock })
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.trackInventory, true)))
    .orderBy(products.name)
    .limit(200)

  const levels = await levelsForProducts(
    storeId,
    rows.map((r) => r.id),
  )

  const items: BranchProduct[] = rows.map((p) => {
    const byBranch: Record<string, number> = {}
    for (const l of levels) {
      if (l.productId !== p.id || l.variantId) continue
      byBranch[l.locationId] = l.available
    }
    return { id: p.id, name: p.name, total: p.stock, byBranch }
  })

  return { branches, products: items }
}
