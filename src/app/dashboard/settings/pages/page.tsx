import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadStorePages } from '@/lib/store-pages-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { PagesEditor } from './pages-editor'

export const metadata = { title: 'صفحات المتجر' }

export default async function StorePagesPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'storefront.manage')

  const rows = await loadStorePages(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="صفحات المتجر"
        description="سياسة الإرجاع والخصوصية والشروط. العميل بيثق أكتر لما يلاقيها مكتوبة."
      />

      <Reveal>
        <PagesEditor pages={rows} />
      </Reveal>
    </div>
  )
}
