import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadBlogPosts } from '@/lib/blog-data'
import { publicStoreUrl } from '@/lib/domain'

/** شكل شاشة المدوّنة اللي تطبيق الموبايل بيستلمه */
export async function blogPayload(store: ActiveStore) {
  const rows = await loadBlogPosts(store.id)
  return {
    posts: rows.map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? '',
      content: p.content ?? '',
      cover: p.cover,
      author: p.author ?? '',
      isPublished: p.isPublished,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      views: p.views,
      url: publicStoreUrl(store, `/blog/${p.slug}`),
    })),
  }
}
