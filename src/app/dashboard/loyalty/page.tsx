import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadLoyalty, wheelPrizeInputs } from '@/lib/loyalty-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { LoyaltyForm } from './loyalty-form'
import { WheelForm } from './wheel-form'
import { RewardsForm, type RewardItem } from './rewards-form'

export const metadata = { title: 'الولاء والنقاط' }

export default async function LoyaltyPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'customers.view')

  const { settings, stats, recent, wheel, prizes, rewards } = await loadLoyalty(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الولاء والنقاط"
        description="خلّي العميل يرجع تاني — نقاط مع كل طلب، وخصم لما يجمعها."
      />

      {settings?.enabled && (
        <div className="grid grid-cols-2 gap-3">
          <Reveal>
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-xs text-[var(--fg-muted)]">عملاء عندهم نقاط</span>
              <span className="tabular text-xl font-bold">{stats.members}</span>
            </Card>
          </Reveal>
          <Reveal delay={60}>
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-xs text-[var(--fg-muted)]">نقاط لسه ما اتصرفتش</span>
              <span className="tabular text-xl font-bold">{stats.outstanding.toLocaleString('ar-EG')}</span>
            </Card>
          </Reveal>
        </div>
      )}

      <Reveal delay={100}>
        <LoyaltyForm settings={settings} currency={store.currency} />
      </Reveal>

      <Reveal delay={110}>
        <section className="border-t border-[var(--border)] pt-6">
          <RewardsForm rewards={rewards as RewardItem[]} currency={store.currency} />
        </section>
      </Reveal>

      <Reveal delay={120}>
        <section className="flex flex-col gap-3 border-t border-[var(--border)] pt-6">
          <div>
            <h2 className="font-semibold">عجلة الحظ</h2>
            <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
              الزائر بياخد كود خصم مقابل رقمه — بتجمعلك أرقام وتزوّد التحويل.
            </p>
          </div>
          <WheelForm settings={wheel} prizes={wheelPrizeInputs(prizes)} />
        </section>
      </Reveal>

      {recent.length > 0 && (
        <Reveal delay={140}>
          <Card className="overflow-hidden">
            <h2 className="border-b border-[var(--border)] px-4 py-3 font-semibold">آخر الحركات</h2>
            <ul className="divide-y divide-[var(--border)]">
              {recent.map((t) => (
                <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <span
                    className="tabular w-16 shrink-0 font-bold"
                    style={{ color: t.points > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
                  >
                    {t.points > 0 ? `+${t.points}` : t.points}
                  </span>
                  <span className="min-w-0 flex-1 truncate">
                    {t.customerName ?? 'عميل'}
                    {t.reason && <span className="text-[var(--fg-subtle)]"> — {t.reason}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      )}
    </div>
  )
}
