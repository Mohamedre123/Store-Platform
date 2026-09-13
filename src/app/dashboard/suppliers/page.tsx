import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadSuppliers } from '@/lib/suppliers-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { SuppliersManager, type ReorderRow, type SupplierRow } from './suppliers-manager'

export const metadata = { title: 'الموردون' }

export default async function SuppliersPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'inventory.manage')

  const { rows, reorder, allProducts, unlinkedCount } = await loadSuppliers(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الموردون"
        description="مين بيوردّلك إيه، وإيه اللي قرّب يخلص ومحتاج تطلبه."
      />

      <Reveal>
        <SuppliersManager
          suppliers={rows as SupplierRow[]}
          reorder={reorder as ReorderRow[]}
          products={allProducts}
          unlinkedCount={unlinkedCount}
          currency={store.currency}
        />
      </Reveal>
    </div>
  )
}
