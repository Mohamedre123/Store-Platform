'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/db'
import { blogPosts } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { slugify } from '@/lib/utils'

export type PostInput = {
  id?: string
  title: string
  slug: string
  excerpt: string
  content: string
  cover: string | null
  author: string
  isPublished: boolean
}

export type PostState = { ok?: boolean; error?: string; slug?: string } | null

/**
 * حفظ مقال.
 *
 * الرابط بيتولّد من العنوان لو التاجر ما كتبوش. لو الرابط متكرّر بنزوّد
 * رقمًا بدل ما نرفض الحفظ — التاجر مش لازم يفهم يعني إيه «رابط مكرّر»
 * وهو بيكتب مقال.
 */
export async function savePostAction(input: PostInput): Promise<PostState> {
  const { store } = await getDashboardContext()

  const title = input.title.trim()
  if (!title) return { error: 'اكتب عنوان المقال' }

  const base = slugify(input.slug.trim() || title) || 'post'
  const slug = await uniqueSlug(store.id, base, input.id)

  const values = {
    title,
    slug,
    excerpt: input.excerpt.trim() || null,
    content: input.content.trim() || null,
    cover: input.cover,
    author: input.author.trim() || null,
    isPublished: input.isPublished,
    // تاريخ النشر بيتسجّل أول مرة بس — التعديل بعد كده ما يغيّرش ترتيب المقالات
    publishedAt: input.isPublished ? new Date() : null,
  }

  if (input.id) {
    const updated = await db
      .update(blogPosts)
      .set(values)
      .where(and(eq(blogPosts.id, input.id), eq(blogPosts.storeId, store.id)))
      .returning({ id: blogPosts.id })
    if (!updated.length) return { error: 'المقال مش موجود' }
  } else {
    await db.insert(blogPosts).values({ ...values, storeId: store.id })
  }

  revalidatePath('/dashboard/blog')
  return { ok: true, slug }
}

async function uniqueSlug(storeId: string, base: string, excludeId?: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`
    const clash = await db
      .select({ id: blogPosts.id })
      .from(blogPosts)
      .where(
        and(
          eq(blogPosts.storeId, storeId),
          eq(blogPosts.slug, candidate),
          excludeId ? ne(blogPosts.id, excludeId) : undefined,
        ),
      )
      .limit(1)
    if (clash.length === 0) return candidate
  }
  return `${base}-${Date.now()}`
}

export async function deletePostAction(id: string): Promise<PostState> {
  const { store } = await getDashboardContext()
  await db.delete(blogPosts).where(and(eq(blogPosts.id, id), eq(blogPosts.storeId, store.id)))
  revalidatePath('/dashboard/blog')
  return { ok: true }
}

export async function togglePostAction(id: string, isPublished: boolean): Promise<PostState> {
  const { store } = await getDashboardContext()
  await db
    .update(blogPosts)
    .set({ isPublished, publishedAt: isPublished ? new Date() : null })
    .where(and(eq(blogPosts.id, id), eq(blogPosts.storeId, store.id)))
  revalidatePath('/dashboard/blog')
  return { ok: true }
}
