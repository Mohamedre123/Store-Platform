import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { pages } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { PagesEditor, type PageRow } from './pages-editor'

export const metadata = { title: 'صفحات المتجر' }

export default async function StorePagesPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'storefront.manage')

  const rows = await db
    .select({
      id: pages.id,
      slug: pages.slug,
      title: pages.title,
      content: pages.content,
      type: pages.type,
      showInFooter: pages.showInFooter,
      isPublished: pages.isPublished,
    })
    .from(pages)
    .where(eq(pages.storeId, store.id))
    .orderBy(pages.sortOrder)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="صفحات المتجر"
        description="سياسة الإرجاع والخصوصية والشروط. العميل بيثق أكتر لما يلاقيها مكتوبة."
      />

      <Reveal>
        <PagesEditor pages={rows as PageRow[]} />
      </Reveal>
    </div>
  )
}
