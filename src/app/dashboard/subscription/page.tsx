import { and, desc, eq } from 'drizzle-orm'
import { Crown, Package, Receipt, ShieldCheck } from 'lucide-react'
import { db } from '@/db'
import { subscriptionRequests, subscriptions } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { getEntitlements, getOrderQuota } from '@/lib/entitlements'
import { ensureAccountId } from '@/lib/account-id'
import { PLANS, PAID_PLANS, STATUS_LABEL, getPlan, daysLeft } from '@/lib/plans'
import { billing } from '@/lib/billing'
import { formatMoney, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-shell'
import { AccountBadge } from '@/components/dashboard/account-badge'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { PayPanel, type PayPlan } from './pay-panel'
import { TrialCard } from './trial-card'

export const metadata = { title: 'الاشتراك' }

const SUB_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  trialing: { label: 'تجريبي', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  active: { label: 'شغّال', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  past_due: { label: 'انتهى', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
  cancelled: { label: 'ملغي', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
}

const REQUEST_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: 'تحت المراجعة', bg: 'var(--color-info-soft)', fg: 'var(--color-info)' },
  approved: { label: 'اتقبل', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  rejected: { label: 'اترفض', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
}

export default async function SubscriptionPage() {
  const { store, user } = await getDashboardContext()

  const [ent, quota, accountId] = await Promise.all([
    getEntitlements(store),
    getOrderQuota(store),
    ensureAccountId(user.id, user.publicId),
  ])

  const [history, requests] = await Promise.all([
    db
      .select({
        id: subscriptions.id,
        plan: subscriptions.plan,
        status: subscriptions.status,
        amount: subscriptions.amount,
        currency: subscriptions.currency,
        interval: subscriptions.interval,
        startedAt: subscriptions.startedAt,
        currentPeriodEnd: subscriptions.currentPeriodEnd,
      })
      .from(subscriptions)
      .where(eq(subscriptions.storeId, store.id))
      .orderBy(desc(subscriptions.createdAt))
      .limit(24),
    db
      .select({
        id: subscriptionRequests.id,
        plan: subscriptionRequests.plan,
        status: subscriptionRequests.status,
        amount: subscriptionRequests.amount,
        note: subscriptionRequests.note,
        createdAt: subscriptionRequests.createdAt,
      })
      .from(subscriptionRequests)
      .where(eq(subscriptionRequests.storeId, store.id))
      .orderBy(desc(subscriptionRequests.createdAt))
      .limit(10),
  ])

  const pending = requests.find((r) => r.status === 'pending') ?? null

  const tone = ent.isAdmin
    ? { bg: 'var(--primary-soft)', fg: 'var(--primary)' }
    : !ent.active
      ? { bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' }
      : ent.onTrial
        ? { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' }
        : { bg: 'var(--color-success-soft)', fg: 'var(--color-success)' }

  const payPlans: PayPlan[] = PAID_PLANS.map((p) => ({
    key: p.key as PayPlan['key'],
    name: p.name,
    price: formatMoney(p.price, store.currency),
    tagline: p.tagline,
    features: p.features,
    highlight: p.highlight,
  }))

  const trial = PLANS.find((p) => p.key === 'trial')!

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الاشتراك"
        description="باقتك الحالية، وإزاي تفتح كل المميزات."
        action={<AccountBadge accountId={accountId} />}
      />

      {/* الحالة الحقيقية */}
      <Reveal>
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={{ background: tone.bg, color: tone.fg }}
            >
              {ent.isAdmin ? (
                <ShieldCheck className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Crown className="h-5 w-5" aria-hidden="true" />
              )}
            </span>
            <div>
              <h2 className="font-semibold">
                {ent.isAdmin
                  ? 'حساب إدارة المنصة'
                  : ent.onTrial
                    ? 'فترة تجريبية'
                    : (STATUS_LABEL[store.status] ?? store.status)}
              </h2>
              <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
                {ent.isAdmin ? (
                  <>كل المميزات مفتوحة من غير اشتراك.</>
                ) : ent.active && ent.until ? (
                  <>
                    {ent.onTrial ? 'التجربة بتنتهي' : 'الاشتراك بينتهي'} في{' '}
                    {formatDate(ent.until)}
                    {ent.daysLeft !== null && ` — فاضل ${ent.daysLeft} يوم`}
                  </>
                ) : ent.expired && ent.until ? (
                  <>انتهى في {formatDate(ent.until)} — المميزات مقفولة لحد ما تجدّد.</>
                ) : (
                  <>مفيش اشتراك شغّال — اختار باقة وافتح كل المميزات.</>
                )}
              </p>
            </div>
          </div>

          {!ent.active && quota.limit !== null && (
            <span
              className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
              style={{
                background: quota.blocked ? 'var(--color-danger-soft)' : 'var(--surface-2)',
                color: quota.blocked ? 'var(--color-danger)' : 'var(--fg-muted)',
              }}
            >
              <Package className="h-4 w-4" aria-hidden="true" />
              <span className="tabular">
                {quota.used} / {quota.limit} طلب
              </span>
            </span>
          )}
        </Card>
      </Reveal>

      {/* اللي بيقف من غير اشتراك — بيتقال صريح بدل ما التاجر يكتشفه لوحده */}
      {!ent.active && (
        <Reveal delay={40}>
          <Card className="flex flex-col gap-3 p-5">
            <h2 className="font-semibold">اللي بيتفتح بالاشتراك</h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {[
                'أدوات الذكاء الاصطناعي — الرد على العملاء، المساعد، ومصمّم الثيمات',
                'صفحات الهبوط — إنشاء وتعديل بلا حدود',
                `الطلبات — من غير اشتراك المتجر بيستقبل ${quota.limit ?? 5} طلبات وبعدها بيقف`,
                'ربط نطاقك الخاص بدل النطاق الفرعي',
              ].map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-[var(--fg-muted)]">
                  <span
                    className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--primary)]"
                    aria-hidden="true"
                  />
                  {f}
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>
      )}

      {/* الباقة التجريبية — التاجر بيبدأها بإيده */}
      {!ent.isAdmin && (
        <Reveal delay={60}>
          <TrialCard
            name={trial.name}
            tagline={trial.tagline}
            state={ent.onTrial ? 'running' : store.trialEndsAt ? 'used' : 'available'}
            daysLeft={ent.daysLeft}
          />
        </Reveal>
      )}

      {/*
        الدفع.

        الملاحظة تحت مقصودة: التاجر لازم يعرف إن ضغطة «تم الدفع»
        **ما بتفعّلش حاجة** قبل ما يدوسها — لا بعد ما يستنى ويسأل
        ليه المميزات لسه مقفولة.
      */}
      {!ent.isAdmin && (
        <Reveal delay={90}>
          <PayPanel
            plans={payPlans}
            payTo={billing.payTo}
            hasPending={Boolean(pending)}
            pendingPlan={pending ? (getPlan(pending.plan)?.name ?? null) : null}
            renewing={ent.active && !ent.onTrial}
          />
        </Reveal>
      )}

      {/* طلبات الاشتراك */}
      {requests.length > 0 && (
        <Reveal>
          <section className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <Receipt
                className="mt-1 h-4 w-4 shrink-0 text-[var(--fg-subtle)]"
                aria-hidden="true"
              />
              <div>
                <h2 className="font-semibold">طلباتك</h2>
                <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
                  كل مرة بعتّ فيها تأكيد دفع — وردّنا عليها.
                </p>
              </div>
            </div>

            <Card className="overflow-hidden p-0">
              <div className="scroll-x">
                <table className="w-full min-w-[30rem] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                      <th className="p-3 text-start font-medium">الباقة</th>
                      <th className="p-3 text-start font-medium">المبلغ</th>
                      <th className="p-3 text-start font-medium">التاريخ</th>
                      <th className="p-3 text-start font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((r) => {
                      const meta = REQUEST_STATUS[r.status] ?? REQUEST_STATUS.pending
                      return (
                        <tr key={r.id} className="border-b border-[var(--border)] last:border-0">
                          <td className="p-3">{getPlan(r.plan)?.name ?? r.plan}</td>
                          <td className="tabular whitespace-nowrap p-3">
                            {formatMoney(r.amount, store.currency)}
                          </td>
                          <td className="whitespace-nowrap p-3 text-xs text-[var(--fg-muted)]">
                            {formatDate(r.createdAt)}
                          </td>
                          <td className="p-3">
                            <span
                              className="inline-block rounded-md px-2 py-0.5 text-xs font-medium"
                              style={{ background: meta.bg, color: meta.fg }}
                            >
                              {meta.label}
                            </span>
                            {r.note && (
                              <span className="mt-1 block text-xs text-[var(--fg-subtle)]">
                                {r.note}
                              </span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </Reveal>
      )}

      {/* سجل الفترات */}
      {history.length > 0 && (
        <Reveal>
          <section className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <Crown className="mt-1 h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
              <div>
                <h2 className="font-semibold">سجل الاشتراكات</h2>
                <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
                  كل فترة اشتراك مرّت على متجرك.
                </p>
              </div>
            </div>

            <Card className="overflow-hidden p-0">
              <div className="scroll-x">
                <table className="w-full min-w-[34rem] text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                      <th className="p-3 text-start font-medium">الباقة</th>
                      <th className="p-3 text-start font-medium">المبلغ</th>
                      <th className="p-3 text-start font-medium">من</th>
                      <th className="p-3 text-start font-medium">لحد</th>
                      <th className="p-3 text-start font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const meta = SUB_STATUS[h.status] ?? SUB_STATUS.trialing
                      const left = daysLeft(h.currentPeriodEnd)
                      return (
                        <tr key={h.id} className="border-b border-[var(--border)] last:border-0">
                          <td className="p-3">
                            {getPlan(h.plan)?.name ?? h.plan}
                            <span className="block text-xs text-[var(--fg-subtle)]">
                              {h.interval === 'year' ? 'سنوي' : 'شهري'}
                            </span>
                          </td>
                          <td className="tabular whitespace-nowrap p-3">
                            {h.amount > 0 ? formatMoney(h.amount, h.currency) : '—'}
                          </td>
                          <td className="whitespace-nowrap p-3 text-xs text-[var(--fg-muted)]">
                            {h.startedAt ? formatDate(h.startedAt) : '—'}
                          </td>
                          <td className="whitespace-nowrap p-3 text-xs text-[var(--fg-muted)]">
                            {h.currentPeriodEnd ? formatDate(h.currentPeriodEnd) : '—'}
                            {left !== null && left >= 0 && h.status === 'active' && (
                              <span className="block text-[var(--fg-subtle)]">
                                فاضل {left} يوم
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <span
                              className="inline-block rounded-md px-2 py-0.5 text-xs font-medium"
                              style={{ background: meta.bg, color: meta.fg }}
                            >
                              {meta.label}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>
        </Reveal>
      )}
    </div>
  )
}
