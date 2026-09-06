'use server'

import { revalidatePath } from 'next/cache'
import { getDashboardContext } from '@/lib/store-context'
import { dismissNotice } from '@/lib/notices'

/**
 * التاجر قفل رسالة.
 *
 * ## من غير فحص صلاحية
 * أي حد داخل اللوحة من حقّه يقفل رسالة معروضة له. الفعل ده ما
 * بيقراش ولا بيغيّر أي بيانات — بيسجّل «شفتها» وخلاص، والمتجر
 * بيتاخد من الجلسة لا من المتصفح.
 */
export async function dismissNoticeAction(noticeId: string): Promise<void> {
  const { store } = await getDashboardContext()

  if (typeof noticeId !== 'string' || noticeId.length < 10) return

  await dismissNotice(store.id, noticeId)
  revalidatePath('/dashboard')
}
