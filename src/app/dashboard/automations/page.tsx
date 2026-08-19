import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { automationRules } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { RuleBuilder, type RuleRow } from './rule-builder'

export const metadata = { title: 'الأتمتة' }

export default async function AutomationsPage() {
  const { store } = await getDashboardContext()

  const rows = await db
    .select()
    .from(automationRules)
    .where(eq(automationRules.storeId, store.id))
    .orderBy(desc(automationRules.createdAt))
    .limit(100)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الأتمتة"
        description="خلّي المنصة تعمل الشغل المتكرّر عنك — لما يحصل كذا، اعمل كذا."
      />

      <Reveal>
        <RuleBuilder rules={rows as RuleRow[]} />
      </Reveal>
    </div>
  )
}
