'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { mediaAssets } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { deleteImage } from '@/lib/storage'
import { usageFor } from '@/lib/media'

export type MediaState = { ok?: boolean; error?: string } | null

/**
 * حذف وسيط — من التخزين ومن المكتبة معًا.
 *
 * ## الاستعمال بيتفحص الأول
 * الصورة اللي اتشالت من التخزين بتبوّظ كل منتج بيشاور عليها، والتاجر
 * ما بيكتشفش غير لما عميل يشتكي من مربّع فاضي. فبنمنع الحذف ونقول
 * له مستعملة في كام منتج — يشيلها من المنتج الأول لو فعلًا عايز.
 *
 * ## والترتيب: التخزين قبل الصف
 * لو مسحنا الصف الأول والتخزين فشل، الملف بيفضل موجود بلا أي صف
 * بيشاور عليه — يعني مساحة مدفوعة على حاجة محدّش يقدر يوصلها ولا
 * يحذفها بعد كده. العكس أرحم: صف باقي على ملف مش موجود بيتشال في
 * أول مزامنة.
 */
export async function deleteMediaAction(id: string): Promise<MediaState> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'storefront.manage')

  const [row] = await db
    .select({ id: mediaAssets.id, path: mediaAssets.path, url: mediaAssets.url })
    .from(mediaAssets)
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.storeId, store.id)))
    .limit(1)

  if (!row) return { error: 'الصورة مش موجودة' }

  const usage = await usageFor(store.id, [row.url])
  const used = usage.get(row.url)?.productImages ?? 0
  if (used > 0) {
    return {
      error: `الصورة دي مستعملة في ${used} منتج. شيلها من المنتج الأول عشان ما يبقاش فيه مربّع فاضي في متجرك.`,
    }
  }

  const removed = await deleteImage(store.id, row.path)
  if (!removed) return { error: 'مقدرناش نمسحها من التخزين. جرّب تاني.' }

  await db.delete(mediaAssets).where(and(eq(mediaAssets.id, row.id), eq(mediaAssets.storeId, store.id)))

  revalidatePath('/dashboard/media')
  return { ok: true }
}

/** إعادة تسمية — الاسم للتاجر بس، المسار على التخزين ما بيتغيّرش */
export async function renameMediaAction(id: string, name: string): Promise<MediaState> {
  const { store, actor } = await getDashboardContext()
  assertCan(actor, 'storefront.manage')

  const clean = name.trim().slice(0, 200)
  if (clean.length < 1) return { error: 'اكتب اسمًا' }

  const updated = await db
    .update(mediaAssets)
    .set({ name: clean })
    .where(and(eq(mediaAssets.id, id), eq(mediaAssets.storeId, store.id)))
    .returning({ id: mediaAssets.id })

  if (!updated.length) return { error: 'الصورة مش موجودة' }

  revalidatePath('/dashboard/media')
  return { ok: true }
}
