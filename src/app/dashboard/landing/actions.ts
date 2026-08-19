'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/db'
import { funnels } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { slugify } from '@/lib/utils'
import { BLOCK_LIBRARY, TEMPLATES, type Block, type LandingTokens } from '@/lib/landing'

export type LandingState = { ok?: boolean; error?: string; id?: string; slug?: string } | null

/** صفحة جديدة من قالب — البلوكات بتتولّد بإعداداتها الافتراضية */
export async function createLandingAction(input: {
  name: string
  template: string
  productId: string | null
}): Promise<LandingState> {
  const { store } = await getDashboardContext()

  const name = input.name.trim()
  if (!name) return { error: 'اكتب اسم الصفحة' }

  const template = TEMPLATES.find((t) => t.key === input.template) ?? TEMPLATES[0]
  const blocks: Block[] = template.blocks.map((type, i) => {
    const def = BLOCK_LIBRARY.find((b) => b.type === type)!
    return { id: `b${Date.now()}${i}`, type, settings: { ...def.defaults } }
  })

  const slug = await uniqueSlug(store.id, slugify(name) || 'offer')

  const [created] = await db
    .insert(funnels)
    .values({
      storeId: store.id,
      slug,
      name,
      productId: input.productId,
      template: template.key,
      blocks,
      status: 'draft',
    })
    .returning({ id: funnels.id })

  revalidatePath('/dashboard/landing')
  return { ok: true, id: created.id, slug }
}

async function uniqueSlug(storeId: string, base: string, excludeId?: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`
    const clash = await db
      .select({ id: funnels.id })
      .from(funnels)
      .where(
        and(
          eq(funnels.storeId, storeId),
          eq(funnels.slug, candidate),
          excludeId ? ne(funnels.id, excludeId) : undefined,
        ),
      )
      .limit(1)
    if (clash.length === 0) return candidate
  }
  return `${base}-${Date.now()}`
}

/**
 * حفظ الصفحة كاملة.
 *
 * البلوكات والهوية بيتحفظوا مع بعض في استدعاء واحد: المحرّر بيعدّل
 * الاتنين في نفس الجلسة، وحفظهم منفصلين كان هيخلّي الصفحة تعدي بحالة
 * نص محفوظة لو واحد نجح والتاني فشل.
 */
export async function saveLandingAction(input: {
  id: string
  name: string
  slug: string
  productId: string | null
  blocks: Block[]
  tokens: LandingTokens
  seoTitle: string
  seoDescription: string
  status: 'draft' | 'published'
}): Promise<LandingState> {
  const { store } = await getDashboardContext()

  const name = input.name.trim()
  if (!name) return { error: 'اكتب اسم الصفحة' }

  const slug = await uniqueSlug(store.id, slugify(input.slug) || slugify(name) || 'offer', input.id)

  const updated = await db
    .update(funnels)
    .set({
      name,
      slug,
      productId: input.productId,
      blocks: input.blocks,
      tokens: input.tokens,
      seoTitle: input.seoTitle.trim() || null,
      seoDescription: input.seoDescription.trim() || null,
      status: input.status,
    })
    .where(and(eq(funnels.id, input.id), eq(funnels.storeId, store.id)))
    .returning({ id: funnels.id })

  if (!updated.length) return { error: 'الصفحة مش موجودة' }

  revalidatePath('/dashboard/landing')
  revalidatePath(`/dashboard/landing/${input.id}`)
  return { ok: true, slug }
}

export async function deleteLandingAction(id: string): Promise<LandingState> {
  const { store } = await getDashboardContext()
  await db.delete(funnels).where(and(eq(funnels.id, id), eq(funnels.storeId, store.id)))
  revalidatePath('/dashboard/landing')
  return { ok: true }
}

export async function toggleLandingAction(id: string, publish: boolean): Promise<LandingState> {
  const { store } = await getDashboardContext()
  await db
    .update(funnels)
    .set({ status: publish ? 'published' : 'draft' })
    .where(and(eq(funnels.id, id), eq(funnels.storeId, store.id)))
  revalidatePath('/dashboard/landing')
  return { ok: true }
}
