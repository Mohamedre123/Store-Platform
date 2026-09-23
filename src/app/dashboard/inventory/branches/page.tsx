import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadBranchesPage } from '@/lib/branches-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { BranchesManager } from '../branches-manager'

export const metadata = { title: 'الفروع والمخازن' }

export default async function BranchesPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'inventory.manage')

  /* الفرع الافتراضي بيتعمل لوحده في أول زيارة — جوّه اللودر */
  const { branches, products: items } = await loadBranchesPage(store.id)

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
