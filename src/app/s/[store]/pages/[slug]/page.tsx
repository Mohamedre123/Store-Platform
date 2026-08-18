import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { pages } from '@/db/schema'
import { getStore } from '@/lib/storefront'

export const dynamic = 'force-dynamic'

async function loadPage(storeId: string, slug: string) {
  const [row] = await db
    .select({ title: pages.title, content: pages.content, seoDescription: pages.seoDescription })
    .from(pages)
    .where(and(eq(pages.storeId, storeId), eq(pages.slug, slug), eq(pages.isPublished, true)))
    .limit(1)
  return row ?? null
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string; slug: string }>
}) {
  const { store: identifier, slug } = await params
  const store = await getStore(identifier)
  if (!store) return { title: 'الصفحة' }
  const page = await loadPage(store.id, slug)
  return { title: page?.title ?? 'الصفحة', description: page?.seoDescription ?? undefined }
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ store: string; slug: string }>
}) {
  const { store: identifier, slug } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const page = await loadPage(store.id, slug)
  if (!page || !page.content) notFound()

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{page.title}</h1>
      {/*
        المحتوى نص عادي كتبه التاجر — بنعرضه بـwhitespace-pre-line بدل
        تفسيره كـHTML. لو سمحنا بـHTML، تاجر (أو حد اخترق حسابه) يقدر
        يحقن سكربت في متجره ويسرق بيانات عملائه.
      */}
      <div className="mt-6 whitespace-pre-line leading-loose opacity-85">{page.content}</div>
    </article>
  )
}
