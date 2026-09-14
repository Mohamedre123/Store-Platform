import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { automationRules, messagingSettings, notificationRecipients } from '@/db/schema'
import { readWhatsapp } from '@/lib/whatsapp'

/**
 * بيانات شاشة الأتمتة — صفحة اللوحة (`/dashboard/automations`) وتطبيق الموبايل
 * (`/api/app/automations`) الاتنين بيقروا من هنا.
 */
export async function loadAutomations(storeId: string) {
  const [rules, whatsapp, [messaging], recipients] = await Promise.all([
    db
      .select()
      .from(automationRules)
      .where(eq(automationRules.storeId, storeId))
      .orderBy(desc(automationRules.createdAt))
      .limit(100),

    /*
      حالة ربط الواتساب.

      الأتمتة بتبعت رسايلها من **نفس** الربط اللي بيبعت تأكيد الطلبات
      وحالة الشحن. والقاعدة اللي إجراؤها واتساب بتتحفظ وتفضل «مفعّلة»
      من غير ما تبعت لو الربط ناقص — فالتاجر يستنى أسبوع وبعدين
      يكتشف إن ولا رسالة خرجت. بنقوله قبل ما يبني لا بعدها.
    */
    readWhatsapp(storeId),

    /*
      توكن بوت تيليجرام.

      `notify-team` بيقرا العمود ده من زمان، ومكانش في أي مكان في
      اللوحة يتحطّ فيه — فالقناة كانت معروضة والتاجر يختارها وما
      يوصلوش ولا إشعار. الحقل بقى في دليل القنوات تحت.
    */
    db
      .select({ telegramBotToken: messagingSettings.telegramBotToken })
      .from(messagingSettings)
      .where(eq(messagingSettings.storeId, storeId))
      .limit(1),

    db
      .select({
        id: notificationRecipients.id,
        name: notificationRecipients.name,
        channel: notificationRecipients.channel,
        phone: notificationRecipients.phone,
        chatId: notificationRecipients.chatId,
        events: notificationRecipients.events,
        isActive: notificationRecipients.isActive,
      })
      .from(notificationRecipients)
      .where(eq(notificationRecipients.storeId, storeId))
      .orderBy(desc(notificationRecipients.createdAt)),
  ])

  return {
    rules,
    recipients,
    whatsappReady: whatsapp.provider !== 'off' && whatsapp.hasKey,
    telegramReady: Boolean(messaging?.telegramBotToken),
  }
}
