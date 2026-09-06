import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { listMarkets } from '@/lib/markets'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { MarketsManager } from './markets-manager'

export const metadata = { title: 'الأسواق والعملات' }

export default async function MarketsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'settings.manage')

  const rows = await listMarkets(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الأسواق والعملات"
        description="بتبيع لبرّه مصر؟ خلّي العميل السعودي يشوف السعر بالريال بدل ما يقعد يحسبه — واللي بيحسب مش بيشتري."
      />

      <Reveal>
        <MarketsManager markets={rows} baseCurrency={store.currency} />
      </Reveal>
    </div>
  )
}
