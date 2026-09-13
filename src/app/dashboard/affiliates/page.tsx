import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadAffiliates } from '@/lib/affiliates-data'
import { publicStoreUrl } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { AffiliatesManager, type AffiliateRow } from './affiliates-manager'

export const metadata = { title: 'المسوّقون بالعمولة' }

export default async function AffiliatesPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'marketing.manage')

  const rows = await loadAffiliates(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المسوّقون بالعمولة"
        description="ادّي كود لكل مسوّق — وكل بيعة تيجي من رابطه تتحسبله تلقائيًا."
      />

      <Reveal>
        <AffiliatesManager
          affiliates={rows as AffiliateRow[]}
          currency={store.currency}
          storeUrl={publicStoreUrl(store)}
        />
      </Reveal>
    </div>
  )
}
