import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadCampaigns } from '@/lib/campaigns-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { CampaignsManager } from './campaigns-manager'

export const metadata = { title: 'حملات البريد' }

export default async function CampaignsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'marketing.manage')

  /* الحملات والمشتركين (ونفس الأرقام اللي شاشة التطبيق بتعرضها) */
  const { rows, subscribers, withoutEmail } = await loadCampaigns(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="حملات البريد"
        description="العملاء اللي سجّلوا بريدهم عندك أرخص قناة بيع — مش محتاجة إعلان ولا وسيط."
      />

      <Reveal>
        <CampaignsManager subscribers={subscribers} withoutEmail={withoutEmail} rows={rows} />
      </Reveal>
    </div>
  )
}
