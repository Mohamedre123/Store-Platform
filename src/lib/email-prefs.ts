import 'server-only'
import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { messagingSettings } from '@/db/schema'

/**
 * مفاتيح رسايل البريد للعميل.
 *
 * ## الافتراضي «مفتوح» في كل الحالات
 * الرسايل دي كانت بتتبعت بلا أي مفتاح، فكل متجر شغّال دلوقتي
 * بيبعتها. والصف في `messaging_settings` ممكن ما يكونش موجود أصلًا
 * (متاجر اتعملت قبل الجدول) — والغياب لازم يتقرا «ابعت» لا «متبعتش»،
 * وإلا أول نشر بيوقّف رسايل تجّار مش طالبين حاجة.
 *
 * ## ومغلّفة بـcache
 * `applyOrderStatus` بيتنادى من الويب هوك ومن اللوحة ومن الطابور،
 * وكل مسار منهم ممكن يغيّر أكتر من حالة في نفس الطلب. من غير
 * التغليف ده كل تغيير بيفتح رحلة زيادة على قاعدة البيانات.
 */

export type EmailPrefs = {
  confirmed: boolean
  processing: boolean
  shipped: boolean
  delivered: boolean
  cancelled: boolean
  returned: boolean
  newOrderToMerchant: boolean
}

const ALL_ON: EmailPrefs = {
  confirmed: true,
  processing: true,
  shipped: true,
  delivered: true,
  cancelled: true,
  returned: true,
  newOrderToMerchant: true,
}

export const getEmailPrefs = cache(async (storeId: string): Promise<EmailPrefs> => {
  const [row] = await db
    .select({
      confirmed: messagingSettings.emailOnConfirmed,
      processing: messagingSettings.emailOnProcessing,
      shipped: messagingSettings.emailOnShipped,
      delivered: messagingSettings.emailOnDelivered,
      cancelled: messagingSettings.emailOnCancelled,
      returned: messagingSettings.emailOnReturned,
      newOrderToMerchant: messagingSettings.emailNewOrderToMerchant,
    })
    .from(messagingSettings)
    .where(eq(messagingSettings.storeId, storeId))
    .limit(1)

  /* الصف مش موجود = المتجر على الافتراضي، والافتراضي كله مفتوح */
  return row ?? ALL_ON
})

/** الحالة دي رسالتها مفتوحة؟ الحالة اللي مش في القايمة بتعدّي */
export function emailAllowedFor(prefs: EmailPrefs, status: string): boolean {
  if (status in prefs) return prefs[status as keyof EmailPrefs]
  return true
}
