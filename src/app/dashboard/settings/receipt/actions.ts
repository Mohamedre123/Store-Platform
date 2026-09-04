'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { thankYouSettings } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'

export type ReceiptState = { ok?: boolean; error?: string } | null

/**
 * إعدادات صفحة الطلب والإيصال.
 *
 * ## المفاتيح هنا كلها شغّالة
 * جدول `thank_you_settings` فيه ١٥ عمودًا اتكتبوا من أول يوم، وأربعة
 * منهم بس كانت الصفحة بتقراهم. الشاشة دي بتعرض **اللي بيشتغل فعلًا**
 * — والباقي اتوصّل بالصفحة أو اتساب لحد ما يتوصّل.
 *
 * مفتاح بيتحفظ وما بيعملش حاجة أسوأ من مفتاح مش موجود: التاجر
 * بيقفله، بيشوف الحاجة لسه ظاهرة، ويفتكر إن المتجر بايظ.
 */
const schema = z.object({
  showOrderSummary: z.boolean(),
  showProgressTracker: z.boolean(),
  showWhatsappButton: z.boolean(),
  showTelegramButton: z.boolean(),
  allowDownloadReceipt: z.boolean(),
  customMessage: z.string().trim().max(300).nullish(),
})

export async function saveReceiptAction(raw: unknown): Promise<ReceiptState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user, actor } = await getDashboardContext()
  assertCan(actor, 'settings.manage')

  const values = {
    showOrderSummary: input.showOrderSummary,
    showProgressTracker: input.showProgressTracker,
    showWhatsappButton: input.showWhatsappButton,
    showTelegramButton: input.showTelegramButton,
    allowDownloadReceipt: input.allowDownloadReceipt,
    customMessage: input.customMessage?.trim() || null,
  }

  /*
    الصف ممكن ما يكونش موجود.

    بيتعمل مع التسجيل، لكن المتاجر اللي اتعملت قبل ما الجدول يتضاف
    مالهاش صف. `insert … on conflict` بيظبّطه من أول حفظة.
  */
  await db
    .insert(thankYouSettings)
    .values({ storeId: store.id, ...values })
    .onConflictDoUpdate({ target: thankYouSettings.storeId, set: values })

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'receipt_settings',
    resourceId: store.id,
    after: values,
  })

  revalidatePath('/dashboard/settings/receipt')
  return { ok: true }
}
