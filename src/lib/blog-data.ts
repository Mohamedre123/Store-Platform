import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { blogPosts } from '@/db/schema'

/**
 * مقالات المدوّنة — صفحة اللوحة (`/dashboard/blog`) وتطبيق الموبايل
 * (`/api/app/blog`) الاتنين بيقروا من هنا.
 */
export async function loadBlogPosts(storeId: string) {
  return db
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
    .where(eq(blogPosts.storeId, storeId))
    .orderBy(desc(blogPosts.createdAt))
    .limit(200)
}
