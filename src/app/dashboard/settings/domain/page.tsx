import { getDashboardContext } from '@/lib/store-context'
import { dnsRecordsFor } from '@/lib/custom-domain'
import { storeUrl } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { DomainForm } from './domain-form'

export const metadata = { title: 'النطاق المخصص' }

export default async function DomainPage() {
  const { store } = await getDashboardContext()

  const token = 'zawya-verify-' + store.id.replace(/-/g, '').slice(0, 24)
  const records = store.customDomain ? dnsRecordsFor(store.customDomain, token) : []

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="النطاق المخصص"
        description="اربط نطاقك الخاص بمتجرك بدل النطاق الفرعي."
      />

      <Reveal>
        <div className="surface flex flex-col gap-1 p-4">
          <span className="text-xs text-[var(--fg-muted)]">نطاق متجرك الحالي</span>
          <bdi dir="ltr" className="font-mono text-sm font-medium">
            {storeUrl(store.slug).replace(/^https?:\/\//, '')}
          </bdi>
          <p className="mt-1 text-xs text-[var(--fg-subtle)]">
            ده بيفضل شغّال دايمًا حتى بعد ما تربط نطاقك الخاص.
          </p>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <DomainForm
          currentDomain={store.customDomain}
          verified={Boolean(store.customDomainVerifiedAt)}
          initialRecords={records}
        />
      </Reveal>
    </div>
  )
}
