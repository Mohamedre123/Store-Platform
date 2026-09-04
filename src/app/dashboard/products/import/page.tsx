import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { ImportWizard } from './import-wizard'

export const metadata = { title: 'استيراد المنتجات' }

export default async function ImportPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'products.manage')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="استيراد المنتجات"
        description="ناقل من منصة تانية؟ صدّر منتجاتك CSV وارفعه هنا بدل ما تدخّلهم واحد واحد."
      />

      <Reveal>
        <ImportWizard currency={store.currency} />
      </Reveal>
    </div>
  )
}
