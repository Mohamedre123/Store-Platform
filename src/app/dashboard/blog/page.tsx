import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadBlogPosts } from '@/lib/blog-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { BlogManager, type PostRow } from './blog-manager'

export const metadata = { title: 'المدوّنة' }

export default async function BlogPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'storefront.manage')

  /* الاستعلام في `src/lib/blog-data.ts` — تطبيق الموبايل بيقرا نفس المقالات */
  const rows = await loadBlogPosts(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المدوّنة"
        description="مقالات بتجيبلك زوّار من جوجل من غير ما تدفع في إعلانات."
      />

      <Reveal>
        <BlogManager posts={rows as PostRow[]} />
      </Reveal>
    </div>
  )
}
