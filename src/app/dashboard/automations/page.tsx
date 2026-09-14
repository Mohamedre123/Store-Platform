import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadAutomations } from '@/lib/automations-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { RuleBuilder, type RuleRow } from './rule-builder'
import { RecipientsManager, type RecipientRow } from './recipients-manager'
import { HowItWorks } from './how-it-works'
import { ChannelsGuide } from './channels-guide'

export const metadata = { title: 'الأتمتة' }

export default async function AutomationsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'marketing.manage')

  /* الاستعلامات (والسبب ورا حالة واتساب وتيليجرام) في `src/lib/automations-data.ts` — تطبيق الموبايل بيقرا نفس البيانات */
  const { rules, recipients, whatsappReady, telegramReady } = await loadAutomations(store.id)

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
        <RuleBuilder rules={rules as RuleRow[]} />
      </Reveal>
    </div>
  )
}
