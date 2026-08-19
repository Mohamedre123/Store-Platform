import { notFound } from 'next/navigation'
import Image from 'next/image'
import { SLink as Link } from '@/components/storefront/store-link'
import { and, desc, eq, isNotNull } from 'drizzle-orm'
import { FileText } from 'lucide-react'
import { db } from '@/db'
import { blogPosts } from '@/db/schema'
import { getStore } from '@/lib/storefront'
import { formatDate } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'المدوّنة' }

export default async function BlogIndex({ params }: { params: Promise<{ store: string }> }) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const posts = await db
    .select({
      slug: blogPosts.slug,
      title: blogPosts.title,
      excerpt: blogPosts.excerpt,
      cover: blogPosts.cover,
      publishedAt: blogPosts.publishedAt,
    })
    .from(blogPosts)
    .where(
      and(
        eq(blogPosts.storeId, store.id),
        eq(blogPosts.isPublished, true),
        isNotNull(blogPosts.content),
      ),
    )
    .orderBy(desc(blogPosts.publishedAt))
    .limit(50)

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="mb-8 text-2xl font-bold tracking-tight sm:text-3xl">المدوّنة</h1>

      {posts.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <FileText className="h-10 w-10 opacity-25" aria-hidden="true" />
          <p className="opacity-65">مافيش مقالات لسه.</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2">
          {posts.map((p) => (
            <Link key={p.slug} href={`/blog/${p.slug}`} className="group flex flex-col gap-3">
              {p.cover && (
                <span className="relative block aspect-[16/10] overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6">
                  <Image
                    src={p.cover}
                    alt=""
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </span>
              )}
              <div>
                <h2 className="text-lg font-bold leading-snug">{p.title}</h2>
                {p.excerpt && <p className="mt-1 line-clamp-2 text-sm opacity-70">{p.excerpt}</p>}
                {p.publishedAt && (
                  <span className="mt-1 block text-xs opacity-55">{formatDate(p.publishedAt)}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
