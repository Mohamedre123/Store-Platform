import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { defaultBranch, levelsForProducts, listBranches } from '@/lib/branches'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { BranchesManager, type BranchProduct } from '../branches-manager'

export const metadata = { title: 'الفروع والمخازن' }

export default async function BranchesPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'inventory.manage')

  /*
    الفرع الافتراضي بيتعمل لوحده في أول زيارة.
    التاجر اللي عنده مكان واحد ما ينفعش نطلب منه يعرّفه قبل ما يشوف
    أي حاجة — الشاشة لازم تشتغل من غير خطوة إعداد.
  */
  await defaultBranch(store.id)
  const branches = await listBranches(store.id)

  const rows = await db
    .select({ id: products.id, name: products.name, stock: products.stock })
    .from(products)
    .where(and(eq(products.storeId, store.id), eq(products.trackInventory, true)))
    .orderBy(products.name)
    .limit(200)

  const levels = await levelsForProducts(
    store.id,
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الفروع والمخازن"
        description="اعرف بضاعتك موجودة فين، وانقلها بين فروعك من غير ما تعدّ من الأول."
      />

      <Reveal>
        <BranchesManager branches={branches} products={items} />
      </Reveal>
    </div>
  )
}
