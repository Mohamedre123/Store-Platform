'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { stores } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'

/**
 * نشر المتجر أو إيقافه.
 *
 * المتجر بيبدأ غير منشور — العميل اللي يفتح الرابط بيلاقي «مش منشور»
 * وميقدرش يطلب. ده مقصود: التاجر يظبّط منتجاته وشكله الأول، وبعدين
 * ينشر بضغطة. الإيقاف بيرجّعه مخفي لو حب يعدّل بهدوء.
 */
export async function togglePublishAction(publish: boolean) {
  const { store } = await getDashboardContext()

  await db
    .update(stores)
    .set({ isPublished: publish })
    .where(eq(stores.id, store.id))

  revalidatePath('/dashboard')
  revalidatePath('/dashboard/settings')
  return { ok: true, isPublished: publish }
}
