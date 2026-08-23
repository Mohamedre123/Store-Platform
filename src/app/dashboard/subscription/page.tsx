import { desc, eq } from 'drizzle-orm'
import { Check, Crown, Receipt, Sparkles } from 'lucide-react'
import { db } from '@/db'
import { subscriptions } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { PLANS, STATUS_LABEL, daysLeft } from '@/lib/plans'
import { brand } from '@/lib/brand'
import { formatMoney, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'

export const metadata = { title: 'الاشتراك' }

/**
 * رابط التواصل للاشتراك — واتساب لو رقم الدعم متظبّط، وإلا بريد.
 * من غير الشرط ده الرابط بيطلع ‎wa.me/‎ فاضي وميفتحش حاجة.
 */
function contactHref(planName: string, storeName: string) {
  const message = `عايز أشترك في خطة ${planName} لمتجر ${storeName}`
  const wa = brand.supportWhatsapp.replace(/[^\d]/g, '')
  if (wa) return `https://wa.me/${wa}?text=${encodeURIComponent(message)}`
  return `mailto:${brand.supportEmail}?subject=${encodeURIComponent('طلب اشتراك')}&body=${encodeURIComponent(message)}`
}

const SUB_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  trialing: { label: 'تجريبي', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  active: { label: 'شغّال', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  past_due: { label: 'متأخّر', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
  cancelled: { label: 'ملغي', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
}

export default async function SubscriptionPage() {
  const { store } = await getDashboardContext()

  /*
    سجل الاشتراكات.

    حالة المتجر بتقول «مشترك لحد امتى» بس. السجل بيقول **إيه اللي
    اتدفع وإمتى** — وده اللي التاجر بيحتاجه لما يسأل «أنا دفعت
    الشهر ده ولا لأ» أو يطلب فاتورة.
  */
  const history = await db
    .select({
      id: subscriptions.id,
      plan: subscriptions.plan,
      status: subscriptions.status,
      amount: subscriptions.amount,
      currency: subscriptions.currency,
      interval: subscriptions.interval,
      startedAt: subscriptions.startedAt,
      currentPeriodEnd: subscriptions.currentPeriodEnd,
      autoRenew: subscriptions.autoRenew,
      paymentReference: subscriptions.paymentReference,
    })
    .from(subscriptions)
    .where(eq(subscriptions.storeId, store.id))
    .orderBy(desc(subscriptions.createdAt))
    .limit(24)

  const isTrial = store.status === 'trial'
  const until = isTrial ? store.trialEndsAt : store.subscribedUntil
  const left = daysLeft(until)
  const expired = left !== null && left < 0

  const tone = expired
    ? { bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' }
    : isTrial
      ? { bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' }
      : { bg: 'var(--color-success-soft)', fg: 'var(--color-success)' }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="الاشتراك" description="خطتك الحالية وخيارات الترقية." />

      {/* الحالة الحقيقية */}
      <Reveal>
        <Card className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg"
              style={{ background: tone.bg, color: tone.fg }}
            >
              <Crown className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-semibold">{STATUS_LABEL[store.status] ?? store.status}</h2>
              <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
                {until ? (
                  expired ? (
                    <>انتهت في {formatDate(until)} — جدّد عشان متجرك يفضل شغّال.</>
                  ) : (
                    <>
                      {isTrial ? 'التجربة بتنتهي' : 'التجديد'} في {formatDate(until)}
                      {left !== null && ` — فاضل ${left} يوم`}
                    </>
                  )
                ) : (
                  'متجرك شغّال. اختار خطة لما تجهز.'
                )}
              </p>
            </div>
          </div>
        </Card>
      </Reveal>

      {/* الخطط */}
      <div className="grid gap-4 lg:grid-cols-3">
        {PLANS.map((plan, i) => (
          <Reveal key={plan.key} delay={i * 70}>
            <Card
              className={`flex h-full flex-col gap-4 p-5 ${
                plan.highlight ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]' : ''
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold">{plan.name}</h3>
                  <p className="mt-0.5 text-xs text-[var(--fg-muted)]">{plan.tagline}</p>
                </div>
                {plan.highlight && (
                  <span className="flex shrink-0 items-center gap-1 rounded-md bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)]">
                    <Sparkles className="h-3 w-3" aria-hidden="true" />
                    الأشهر
                  </span>
                )}
              </div>

              <div className="flex items-baseline gap-1">
                <span className="tabular text-2xl font-bold tracking-tight">
                  {formatMoney(plan.priceMonthly, store.currency)}
                </span>
                <span className="text-sm text-[var(--fg-muted)]">/ شهر</span>
              </div>

              <ul className="flex flex-1 flex-col gap-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--color-success)]" aria-hidden="true" />
                    <span className="text-[var(--fg-muted)]">{f}</span>
                  </li>
                ))}
              </ul>

              <a
                href={contactHref(plan.name, store.name)}
                target={brand.supportWhatsapp ? '_blank' : undefined}
                rel={brand.supportWhatsapp ? 'noopener noreferrer' : undefined}
                className={`flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold transition-opacity hover:opacity-90 ${
                  plan.highlight
                    ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                    : 'border border-[var(--border-strong)] text-[var(--fg)]'
                }`}
              >
                اختار {plan.name}
              </a>
            </Card>
          </Reveal>
        ))}
      </div>

      {history.length > 0 && (
        <Reveal>
          <section className="flex flex-col gap-3">
            <div className="flex items-start gap-2">
              <Receipt
                className="mt-1 h-4 w-4 shrink-0 text-[var(--fg-subtle)]"
                aria-hidden="true"
              />
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
                      <th className="p-3 text-start font-medium">الخطة</th>
                      <th className="p-3 text-start font-medium">المبلغ</th>
                      <th className="p-3 text-start font-medium">من</th>
                      <th className="p-3 text-start font-medium">لحد</th>
                      <th className="p-3 text-start font-medium">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => {
                      const meta = SUB_STATUS[h.status] ?? SUB_STATUS.trialing
                      return (
                        <tr key={h.id} className="border-b border-[var(--border)] last:border-0">
                          <td className="p-3">
                            {PLANS.find((p) => p.key === h.plan)?.name ?? h.plan}
                            <span className="block text-xs text-[var(--fg-subtle)]">
                              {h.interval === 'year' ? 'سنوي' : 'شهري'}
                              {h.autoRenew ? ' · بيتجدّد تلقائي' : ''}
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

      <Reveal>
        <p className="text-sm text-[var(--fg-subtle)]">
          الدفع الإلكتروني للاشتراك لسه بيتربط. لحد ما يخلص، الاشتراك بيتفعّل بالتواصل معانا
          {brand.supportEmail ? (
            <>
              {' '}
              على{' '}
              <a href={`mailto:${brand.supportEmail}`} className="text-[var(--primary)] hover:underline">
                {brand.supportEmail}
              </a>
            </>
          ) : null}
          .
        </p>
      </Reveal>
    </div>
  )
}
