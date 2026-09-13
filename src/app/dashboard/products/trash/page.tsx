import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadTrash } from '@/lib/trash-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { TrashManager } from './trash-manager'

export const metadata = { title: 'سلة المهملات' }

export default async function TrashPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'products.manage')

  const rows = await loadTrash(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="سلة المهملات"
        description="المنتجات اللي حذفتها — رجّعها بضغطة، أو امسحها نهائيًا وإنت عارف."
      />

      <Reveal>
        <TrashManager currency={store.currency} rows={rows} />
      </Reveal>
    </div>
  )
}
