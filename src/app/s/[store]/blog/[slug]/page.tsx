import { notFound } from 'next/navigation'
import Image from 'next/image'
import { SLink as Link } from '@/components/storefront/store-link'
import { and, eq, sql } from 'drizzle-orm'
import { ChevronLeft } from 'lucide-react'
import { db } from '@/db'
import { blogPosts } from '@/db/schema'
import { getStore } from '@/lib/storefront'
import { formatDate, decodeSlug } from '@/lib/utils'

export const dynamic = 'force-dynamic'

async function loadPost(storeId: string, slug: string) {
  const [row] = await db
    .select()
    .from(blogPosts)
    .where(
      and(eq(blogPosts.storeId, storeId), eq(blogPosts.slug, slug), eq(blogPosts.isPublished, true)),
    )
    .limit(1)
  return row ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string; slug: string }>
}) {
  const { store: identifier, slug: rawSlug } = await params
  const slug = decodeSlug(rawSlug)
  const store = await getStore(identifier)
  if (!store) return { title: 'مقال' }
  const post = await loadPost(store.id, slug)
  return {
    title: post?.seoTitle ?? post?.title ?? 'مقال',
    description: post?.seoDescription ?? post?.excerpt ?? undefined,
  }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ store: string; slug: string }>
}) {
  const { store: identifier, slug: rawSlug } = await params
  const slug = decodeSlug(rawSlug)
  const store = await getStore(identifier)
  if (!store) notFound()

  const post = await loadPost(store.id, slug)
  if (!post || !post.content) notFound()

  // عدّاد المشاهدات — بدون await عشان ما يأخّرش عرض الصفحة
  void db
    .update(blogPosts)
    .set({ views: sql`${blogPosts.views} + 1` })
    .where(eq(blogPosts.id, post.id))
    .catch(() => {})

  return (
    <article className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <Link
        href="/blog"
        className="mb-6 inline-flex items-center gap-1 text-sm opacity-65 hover:opacity-100"
      >
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        كل المقالات
      </Link>

      <h1 className="text-2xl font-bold leading-snug tracking-tight sm:text-3xl">{post.title}</h1>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm opacity-60">
        {post.author && <span>{post.author}</span>}
        {post.author && post.publishedAt && <span>·</span>}
        {post.publishedAt && <span>{formatDate(post.publishedAt)}</span>}
      </div>

      {post.cover && (
        <span className="relative mt-6 block aspect-[16/9] overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6">
          <Image src={post.cover} alt="" fill sizes="(max-width: 768px) 100vw, 768px" className="object-cover" priority />
        </span>
      )}

      {/*
        نص عادي لا HTML — نفس سبب صفحات السياسات: لو سمحنا بـHTML، حد
        اخترق حساب تاجر يقدر يحقن سكربت في متجره ويسرق بيانات عملائه.
      */}
      <div className="mt-8 whitespace-pre-line text-[1.05rem] leading-loose opacity-85">
        {post.content}
      </div>
    </article>
  )
}
