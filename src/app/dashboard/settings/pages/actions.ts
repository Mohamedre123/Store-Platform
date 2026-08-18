'use server'

import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { pages } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'

export type PageState = { ok?: boolean; error?: string } | null

/**
 * حفظ صفحة ثابتة (سياسة إرجاع، خصوصية، شروط…).
 *
 * الصفحات دي بتتعمل فاضية عند إنشاء المتجر، والتاجر بيملاها. الفاضية
 * ما بتظهرش للعميل — صفحة سياسة فاضية أسوأ من مفيش صفحة أصلًا.
 */
export async function savePageAction(input: {
  id: string
  title: string
  content: string
  showInFooter: boolean
}): Promise<PageState> {
  const { store } = await getDashboardContext()

  const title = input.title.trim()
  if (!title) return { error: 'عنوان الصفحة مطلوب' }

  const content = input.content.trim()

  const updated = await db
    .update(pages)
    .set({
      title,
      content: content || null,
      showInFooter: input.showInFooter,
      // الصفحة الفاضية تُعتبر غير منشورة تلقائيًا
      isPublished: content.length > 0,
    })
    .where(and(eq(pages.id, input.id), eq(pages.storeId, store.id)))
    .returning({ id: pages.id })

  if (!updated.length) return { error: 'الصفحة مش موجودة' }

  revalidatePath('/dashboard/settings/pages')
  return { ok: true }
}
