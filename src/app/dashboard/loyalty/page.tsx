import { asc, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, loyaltyTransactions, rewards, wheelPrizes, wheelSettings } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { getLoyaltySettings } from '@/lib/loyalty'
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

  const [settings, [stats], recent, [wheelCfg], wheelPrizeRows, rewardRows] = await Promise.all([
    getLoyaltySettings(store.id),
    db
      .select({
        members: sql<number>`count(*) filter (where ${customers.points} > 0)::int`,
        outstanding: sql<number>`coalesce(sum(${customers.points}), 0)::int`,
      })
      .from(customers)
      .where(eq(customers.storeId, store.id)),
    db
      .select({
        id: loyaltyTransactions.id,
        points: loyaltyTransactions.points,
        type: loyaltyTransactions.type,
        reason: loyaltyTransactions.reason,
        createdAt: loyaltyTransactions.createdAt,
        customerName: customers.name,
      })
      .from(loyaltyTransactions)
      .leftJoin(customers, eq(customers.id, loyaltyTransactions.customerId))
      .where(eq(loyaltyTransactions.storeId, store.id))
      .orderBy(desc(loyaltyTransactions.createdAt))
      .limit(20),
    db.select().from(wheelSettings).where(eq(wheelSettings.storeId, store.id)).limit(1),
    db.select().from(wheelPrizes).where(eq(wheelPrizes.storeId, store.id)).orderBy(wheelPrizes.position),
    db
      .select()
      .from(rewards)
      .where(eq(rewards.storeId, store.id))
      .orderBy(asc(rewards.sortOrder), asc(rewards.pointsCost)),
  ])

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
              <span className="tabular text-xl font-bold">{stats?.members ?? 0}</span>
            </Card>
          </Reveal>
          <Reveal delay={60}>
            <Card className="flex flex-col gap-1 p-4">
              <span className="text-xs text-[var(--fg-muted)]">نقاط لسه ما اتصرفتش</span>
              <span className="tabular text-xl font-bold">
                {(stats?.outstanding ?? 0).toLocaleString('ar-EG')}
              </span>
            </Card>
          </Reveal>
        </div>
      )}

      <Reveal delay={100}>
        <LoyaltyForm settings={settings} currency={store.currency} />
      </Reveal>

      <Reveal delay={110}>
        <section className="border-t border-[var(--border)] pt-6">
          <RewardsForm rewards={rewardRows as RewardItem[]} currency={store.currency} />
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
          <WheelForm
            settings={wheelCfg}
            prizes={wheelPrizeRows.map((p) => ({
              id: p.id,
              label: p.label,
              color: p.color,
              type: p.type,
              value:
                p.type === 'coupon_percent'
                  ? String(p.value / 100)
                  : p.type === 'coupon_fixed'
                    ? String(p.value / 100)
                    : String(p.value),
              chance: String(p.probabilityBps / 100),
            }))}
          />
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
