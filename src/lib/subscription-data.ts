import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { subscriptionRequests, subscriptions } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import type { SessionUser } from '@/lib/auth'
import { getEntitlements, getOrderQuota } from '@/lib/entitlements'
import { ensureAccountId } from '@/lib/account-id'
import { trialState } from '@/lib/plans'

/**
 * بيانات صفحة الاشتراك — صفحة اللوحة و`/api/app/subscription` بيقروا من هنا.
 * نفس الاستعلامات والأحكام اللي كانت في الصفحة.
 */

export const SUB_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  trialing: { label: 'تجريبي', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  active: { label: 'شغّال', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  past_due: { label: 'انتهى', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
  cancelled: { label: 'ملغي', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
}

export const REQUEST_STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  pending: { label: 'تحت المراجعة', bg: 'var(--color-info-soft)', fg: 'var(--color-info)' },
  approved: { label: 'اتقبل', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  rejected: { label: 'اترفض', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
}

export async function loadSubscription(store: ActiveStore, user: SessionUser) {
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

  /* نفس الحكم اللي `startTrialAction` بيفحص بيه — مصدر واحد */
  const trialCard = trialState({
    onTrial: ent.onTrial,
    trialEndsAt: store.trialEndsAt,
    subscribedUntil: store.subscribedUntil,
  })

  return {
    ent,
    quota,
    accountId,
    history,
    requests,
    pending: requests.find((r) => r.status === 'pending') ?? null,
    trialCard,
  }
}
