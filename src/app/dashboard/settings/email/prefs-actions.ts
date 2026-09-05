'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { messagingSettings } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { assertCan } from '@/lib/permissions'
import { recordAudit } from '@/lib/audit'

export type EmailPrefsState = { ok?: boolean; error?: string } | null

const schema = z.object({
  confirmed: z.boolean(),
  processing: z.boolean(),
  shipped: z.boolean(),
  delivered: z.boolean(),
  cancelled: z.boolean(),
  returned: z.boolean(),
  newOrderToMerchant: z.boolean(),
})

/**
 * حفظ مفاتيح رسايل البريد.
 *
 * `insert … on conflict` لأن الصف ممكن ما يكونش موجود: `messaging_settings`
 * بيتعمل مع التسجيل، لكن المتاجر اللي اتعملت قبل الجدول مالهاش صف —
 * وأول حفظة بتعمله.
 */
export async function saveEmailPrefsAction(raw: unknown): Promise<EmailPrefsState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user, actor } = await getDashboardContext()
  assertCan(actor, 'settings.manage')

  const values = {
    emailOnConfirmed: input.confirmed,
    emailOnProcessing: input.processing,
    emailOnShipped: input.shipped,
    emailOnDelivered: input.delivered,
    emailOnCancelled: input.cancelled,
    emailOnReturned: input.returned,
    emailNewOrderToMerchant: input.newOrderToMerchant,
  }

  await db
    .insert(messagingSettings)
    .values({ storeId: store.id, ...values })
    .onConflictDoUpdate({ target: messagingSettings.storeId, set: values })

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'email_prefs',
    after: values,
  })

  revalidatePath('/dashboard/settings/email')
  return { ok: true }
}
