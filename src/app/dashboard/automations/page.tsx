import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { automationRules, notificationRecipients } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { RuleBuilder, type RuleRow } from './rule-builder'
import { RecipientsManager, type RecipientRow } from './recipients-manager'

export const metadata = { title: 'الأتمتة' }

export default async function AutomationsPage() {
  const { store } = await getDashboardContext()

  const rows = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.storeId, store.id))
    .orderBy(desc(automationRules.createdAt))
    .limit(100)

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

      {/*
        المستقبلون فوق القواعد: التاجر الجديد محتاج يوصله إشعار
        بالطلب قبل ما يفكّر في بناء قاعدة أتمتة — والأول خطوة
        واحدة، والتاني محتاج يفهم الشروط والإجراءات.
      */}
      <Reveal>
        <RecipientsManager recipients={recipients as RecipientRow[]} />
      </Reveal>

      <Reveal delay={60}>
        <RuleBuilder rules={rows as RuleRow[]} />
      </Reveal>
    </div>
  )
}
