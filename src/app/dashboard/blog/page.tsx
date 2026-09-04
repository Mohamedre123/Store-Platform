import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { blogPosts } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { BlogManager, type PostRow } from './blog-manager'

export const metadata = { title: 'المدوّنة' }

export default async function BlogPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'storefront.manage')

  const rows = await db
    .select({
      id: blogPosts.id,
      title: blogPosts.title,
      slug: blogPosts.slug,
      excerpt: blogPosts.excerpt,
      content: blogPosts.content,
      cover: blogPosts.cover,
      author: blogPosts.author,
      isPublished: blogPosts.isPublished,
      publishedAt: blogPosts.publishedAt,
      views: blogPosts.views,
    })
    .from(blogPosts)
    .where(eq(blogPosts.storeId, store.id))
    .orderBy(desc(blogPosts.createdAt))
    .limit(200)

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
