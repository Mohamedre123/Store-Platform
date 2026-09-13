import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import type { SessionUser } from '@/lib/auth'
import { loadSubscription, REQUEST_STATUS, SUB_STATUS } from '@/lib/subscription-data'
import { PAID_PLANS, PLANS, STATUS_LABEL, daysLeft, getPlan } from '@/lib/plans'
import { formatDate, formatMoney } from '@/lib/utils'

/** شكل صفحة الاشتراك اللي تطبيق الموبايل بيستلمه — نفس نصوص الصفحة */
export async function subscriptionPayload(store: ActiveStore, user: SessionUser) {
  const { ent, quota, accountId, history, requests, pending, trialCard } = await loadSubscription(store, user)
  const trial = PLANS.find((p) => p.key === 'trial')!

  const text = ent.isAdmin
    ? 'كل المميزات مفتوحة من غير اشتراك.'
    : ent.active && ent.until
      ? `${ent.onTrial ? 'التجربة بتنتهي' : 'الاشتراك بينتهي'} في ${formatDate(ent.until)}`
      : ent.expired && ent.until
        ? `انتهى في ${formatDate(ent.until)} — المميزات مقفولة لحد ما تجدّد.`
        : 'مفيش اشتراك شغّال — اختار باقة وافتح كل المميزات.'

  return {
    accountId,
    isAdmin: ent.isAdmin,
    active: ent.active,
    onTrial: ent.onTrial,
    expired: ent.expired,
    title: ent.isAdmin ? 'حساب إدارة المنصة' : ent.onTrial ? 'فترة تجريبية' : (STATUS_LABEL[store.status] ?? store.status),
    text,
    tone: ent.isAdmin ? 'primary' : !ent.active ? 'danger' : ent.onTrial ? 'warning' : 'success',
    daysLeft: ent.active ? ent.daysLeft : null,
    quota: { limit: quota.limit, used: quota.used, blocked: quota.blocked },
    trial: { state: trialCard, name: trial.name, tagline: trial.tagline },
    plans: PAID_PLANS.map((p) => ({
      key: p.key,
      name: p.name,
      priceLabel: formatMoney(p.price, store.currency),
      tagline: p.tagline,
      features: p.features,
      highlight: Boolean(p.highlight),
    })),
    pendingPlan: pending ? (getPlan(pending.plan)?.name ?? pending.plan) : null,
    requests: requests.map((r) => {
      const meta = REQUEST_STATUS[r.status] ?? REQUEST_STATUS.pending
      return {
        id: r.id,
        planName: getPlan(r.plan)?.name ?? r.plan,
        amountLabel: formatMoney(r.amount, store.currency),
        dateLabel: formatDate(r.createdAt),
        statusLabel: meta.label,
        bg: meta.bg,
        fg: meta.fg,
        note: r.note,
      }
    }),
    history: history.map((h) => {
      const meta = SUB_STATUS[h.status] ?? SUB_STATUS.trialing
      const left = daysLeft(h.currentPeriodEnd)
      return {
        id: h.id,
        planName: getPlan(h.plan)?.name ?? h.plan,
        intervalLabel: h.interval === 'year' ? 'سنوي' : 'شهري',
        amountLabel: h.amount > 0 ? formatMoney(h.amount, h.currency) : '—',
        fromLabel: h.startedAt ? formatDate(h.startedAt) : '—',
        toLabel: h.currentPeriodEnd ? formatDate(h.currentPeriodEnd) : '—',
        daysLeft: left !== null && left >= 0 && h.status === 'active' ? left : null,
        statusLabel: meta.label,
        bg: meta.bg,
        fg: meta.fg,
      }
    }),
  }
}
