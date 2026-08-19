'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { banners } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'

export type BannerInput = {
  id?: string
  placement: 'hero' | 'promo' | 'category' | 'popup'
  title: string
  subtitle: string
  imageDesktop: string | null
  imageMobile: string | null
  ctaLabel: string
  ctaUrl: string
  startsAt: string
  endsAt: string
  isActive: boolean
}

export type BannerState = { ok?: boolean; error?: string } | null

/**
 * حفظ بانر.
 *
 * البانر من غير صورة ولا عنوان مالوش معنى — بيبقى مساحة فاضية في
 * المتجر. بنرفضه بدل ما التاجر يلاقي فراغًا ويستغرب.
 */
export async function saveBannerAction(input: BannerInput): Promise<BannerState> {
  const { store } = await getDashboardContext()

  if (!input.imageDesktop && !input.title.trim()) {
    return { error: 'البانر محتاج صورة أو عنوان على الأقل' }
  }

  const parseDate = (s: string) => (s ? new Date(s) : null)
  const startsAt = parseDate(input.startsAt)
  const endsAt = parseDate(input.endsAt)
  if (startsAt && endsAt && endsAt < startsAt) {
    return { error: 'تاريخ الانتهاء قبل البداية' }
  }

  const values = {
    placement: input.placement,
    title: input.title.trim() || null,
    subtitle: input.subtitle.trim() || null,
    imageDesktop: input.imageDesktop,
    imageMobile: input.imageMobile,
    ctaLabel: input.ctaLabel.trim() || null,
    ctaUrl: input.ctaUrl.trim() || null,
    startsAt,
    endsAt,
    isActive: input.isActive,
  }

  if (input.id) {
    const updated = await db
      .update(banners)
      .set(values)
      .where(and(eq(banners.id, input.id), eq(banners.storeId, store.id)))
      .returning({ id: banners.id })
    if (!updated.length) return { error: 'البانر مش موجود' }
  } else {
    await db.insert(banners).values({ ...values, storeId: store.id })
  }

  revalidatePath('/dashboard/storefront/banners')
  return { ok: true }
}

export async function deleteBannerAction(id: string): Promise<BannerState> {
  const { store } = await getDashboardContext()
  await db.delete(banners).where(and(eq(banners.id, id), eq(banners.storeId, store.id)))
  revalidatePath('/dashboard/storefront/banners')
  return { ok: true }
}

export async function toggleBannerAction(id: string, isActive: boolean): Promise<BannerState> {
  const { store } = await getDashboardContext()
  await db
    .update(banners)
    .set({ isActive })
    .where(and(eq(banners.id, id), eq(banners.storeId, store.id)))
  revalidatePath('/dashboard/storefront/banners')
  return { ok: true }
}
