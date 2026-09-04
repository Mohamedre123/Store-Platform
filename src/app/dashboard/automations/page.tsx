import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { automationRules, notificationRecipients } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { RuleBuilder, type RuleRow } from './rule-builder'
import { RecipientsManager, type RecipientRow } from './recipients-manager'
import { HowItWorks } from './how-it-works'
import { ChannelsGuide } from './channels-guide'
import { messagingSettings } from '@/db/schema'
import { readWhatsapp } from '@/lib/whatsapp'

export const metadata = { title: 'الأتمتة' }

export default async function AutomationsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'marketing.manage')

  const rows = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.storeId, store.id))
    .orderBy(desc(automationRules.createdAt))
    .limit(100)

  /*
    حالة ربط الواتساب.

    الأتمتة بتبعت رسايلها من **نفس** الربط اللي بيبعت تأكيد الطلبات
    وحالة الشحن. والقاعدة اللي إجراؤها واتساب بتتحفظ وتفضل «مفعّلة»
    من غير ما تبعت لو الربط ناقص — فالتاجر يستنى أسبوع وبعدين
    يكتشف إن ولا رسالة خرجت. بنقوله قبل ما يبني لا بعدها.
  */
  const whatsapp = await readWhatsapp(store.id)
  const whatsappReady = whatsapp.provider !== 'off' && whatsapp.hasKey

  /*
    توكن بوت تيليجرام.

    `notify-team` بيقرا العمود ده من زمان، ومكانش في أي مكان في
    اللوحة يتحطّ فيه — فالقناة كانت معروضة والتاجر يختارها وما
    يوصلوش ولا إشعار. الحقل بقى في دليل القنوات تحت.
  */
  const [messaging] = await db
    .select({ telegramBotToken: messagingSettings.telegramBotToken })
    .from(messagingSettings)
    .where(eq(messagingSettings.storeId, store.id))
    .limit(1)
  const telegramReady = Boolean(messaging?.telegramBotToken)

  const recipients = await db
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
    .where(eq(notificationRecipients.storeId, store.id))
    .orderBy(desc(notificationRecipients.createdAt))

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="الأتمتة"
        description="خلّي المنصة تعمل الشغل المتكرّر عنك — لما يحصل كذا، اعمل كذا."
      />

      <Reveal>
        <HowItWorks whatsappReady={whatsappReady} />
      </Reveal>

      <Reveal delay={40}>
        <ChannelsGuide telegramReady={telegramReady} whatsappReady={whatsappReady} />
      </Reveal>

      {/*
        المستقبلون فوق القواعد: التاجر الجديد محتاج يوصله إشعار
        بالطلب قبل ما يفكّر في بناء قاعدة أتمتة — والأول خطوة
        واحدة، والتاني محتاج يفهم الشروط والإجراءات.
      */}
      <Reveal delay={60}>
        <RecipientsManager recipients={recipients as RecipientRow[]} />
      </Reveal>

      <Reveal delay={120}>
        <RuleBuilder rules={rows as RuleRow[]} />
      </Reveal>
    </div>
  )
}
