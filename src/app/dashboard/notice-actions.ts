'use server'

import { revalidatePath } from 'next/cache'
import { getDashboardContext } from '@/lib/store-context'
import { dismissNotice } from '@/lib/notices'
import { redeemNoticeReward } from '@/lib/notice-rewards'

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

/**
 * التاجر فعّل مكافأته بضغطة.
 *
 * ## المتجر من الجلسة، والاستحقاق من القاعدة
 * المتصفح بيبعت معرّف الرسالة وبس. المتجر بيتاخد من الجلسة،
 * والاستحقاق بيتفحص جوّه `redeemNoticeReward` من الأول — يعني
 * معرّف مكتوب بالإيد بيرجع بـ«مش متاحة لك» لا بشهر مجاني.
 */
export async function redeemNoticeAction(
  noticeId: string,
): Promise<{ ok?: true; until?: string; error?: string }> {
  const { store } = await getDashboardContext()

  if (typeof noticeId !== 'string' || noticeId.length < 10) {
    return { error: 'الرسالة مش موجودة' }
  }

  const res = await redeemNoticeReward(store.id, noticeId)
  if (!res.ok) return { error: res.error }

  /*
    اللوحة كلها بتتحدّث — لا البطاقة وحدها.

    بطاقة الاشتراك وشريط المدة الفاضلة بيقروا نفس التاريخ اللي
    اتغيّر دلوقتي. لو حدّثنا الرسالة وحدها، التاجر بيشوف «تمّت»
    فوق و«فاضلك يومين» تحتها في نفس الشاشة.
  */
  revalidatePath('/dashboard')
  revalidatePath('/dashboard/subscription')

  return { ok: true, until: res.until.toISOString() }
}
