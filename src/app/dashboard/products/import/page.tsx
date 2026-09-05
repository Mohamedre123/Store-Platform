import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { ImportWizard } from './import-wizard'
import { ApiImport, ImportDivider } from './api-import'

export const metadata = { title: 'استيراد المنتجات' }

export default async function ImportPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'products.manage')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="استيراد المنتجات"
        description="ناقل من منصة تانية؟ اربط حسابك وهنجيب كتالوجك كله — أو ارفع ملف CSV."
      />

      <Reveal>
        <ApiImport />
      </Reveal>

      <Reveal delay={60}>
        <ImportDivider />
      </Reveal>

      <Reveal delay={100}>
        <ImportWizard currency={store.currency} />
      </Reveal>
    </div>
  )
}
