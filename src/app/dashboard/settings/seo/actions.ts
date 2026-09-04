'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { stores } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'

export type SeoState = { ok?: boolean; error?: string } | null

/**
 * سيو المتجر وتوفّره.
 *
 * الاتنين في شاشة واحدة عن قصد: التاجر اللي بيقفل متجره للصيانة
 * بيقفل الفهرسة معاه غالبًا، واللي بيفتح «قريبًا» بيكتب وصفًا يخصّ
 * الافتتاح. فصلهم كان هيخلّيه يظبّط واحد وينسى التاني.
 */
const schema = z.object({
  /*
    الحدود دي مش تعسّف: جوجل بيقصّ العنوان عند ~٦٠ حرفًا والوصف عند
    ~١٦٠. اللي بيكتب أطول بيلاقي جملته مقطوعة في نص كلمة في النتايج،
    ومش فاهم ليه.
  */
  seoTitle: z.string().trim().max(70).nullish(),
  seoDescription: z.string().trim().max(180).nullish(),
  seoKeywords: z.string().trim().max(300).nullish(),
  ogImage: z.string().trim().max(600).nullish(),
  allowIndexing: z.boolean(),

  maintenanceMode: z.boolean(),
  maintenanceMessage: z.string().trim().max(300).nullish(),
  comingSoon: z.boolean(),
  comingSoonMessage: z.string().trim().max(300).nullish(),
})

export async function saveSeoAction(raw: unknown): Promise<SeoState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user, actor } = await getDashboardContext()
  assertCan(actor, 'settings.manage')

  /**
   * الوضعين ما ينفعش يشتغلوا مع بعض.
   *
   * الصيانة بترجّع «ارجع بعدين» و«قريبًا» بتقول «لسه ما فتحناش» —
   * والاتنين مع بعض معناهم شاشة واحدة بترسم رسالة والتانية مختفية،
   * والتاجر بيقفل واحد ويفضل المتجر مقفول ومش فاهم ليه.
   *
   * الصيانة بتغلب لأنها الأعجل: اللي دوسها عنده مشكلة دلوقتي.
   */
  const maintenance = input.maintenanceMode
  const coming = maintenance ? false : input.comingSoon

  await db
    .update(stores)
    .set({
      seoTitle: input.seoTitle?.trim() || null,
      seoDescription: input.seoDescription?.trim() || null,
      seoKeywords: input.seoKeywords?.trim() || null,
      ogImage: input.ogImage?.trim() || null,
      allowIndexing: input.allowIndexing,
      maintenanceMode: maintenance,
      maintenanceMessage: input.maintenanceMessage?.trim() || null,
      comingSoon: coming,
      comingSoonMessage: input.comingSoonMessage?.trim() || null,
    })
    .where(eq(stores.id, store.id))

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'seo',
    before: {
      maintenanceMode: store.maintenanceMode,
      comingSoon: store.comingSoon,
      allowIndexing: store.allowIndexing,
    },
    after: { maintenanceMode: maintenance, comingSoon: coming, allowIndexing: input.allowIndexing },
  })

  revalidatePath('/dashboard/settings/seo')
  return { ok: true }
}
