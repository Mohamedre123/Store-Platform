import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadLoyalty, wheelPrizeInputs } from '@/lib/loyalty-data'
import { DEFAULT_TIERS } from '@/lib/loyalty-meta'
import { REWARD_TYPES, TIER_LABELS, TIER_ORDER, rewardTypeLabel } from '@/lib/rewards-meta'

/** شكل شاشة الولاء والنقاط اللي تطبيق الموبايل بيستلمه */
export async function loyaltyPayload(store: ActiveStore) {
  const { settings: s, stats, recent, wheel, prizes, rewards } = await loadLoyalty(store.id)
  const tiers = s?.tiers?.length ? s.tiers : DEFAULT_TIERS

  return {
    currency: store.currency,
    enabled: s?.enabled ?? false,
    settings: {
      pointsPerPound: s?.pointsPerUnit ?? 1,
      pointValue: s?.pointValue ?? 1,
      minPointsToRedeem: s?.minPointsToRedeem ?? 100,
      welcomePoints: s?.welcomePoints ?? 0,
      reviewPoints: s?.reviewPoints ?? 0,
      referralPoints: s?.referralPoints ?? 0,
    },
    tiers: tiers.map((t) => ({ key: t.key, name: t.name, minPoints: t.minPoints, color: t.color, discountBps: t.discountBps })),
    stats,
    rewardTypes: REWARD_TYPES.map((t) => ({ key: t.key, label: t.label, unit: t.unit })),
    tierOptions: TIER_ORDER.map((key) => ({ key, label: TIER_LABELS[key] })),
    rewards: rewards.map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      type: r.type,
      typeLabel: rewardTypeLabel(r.type),
      value: r.value,
      pointsCost: r.pointsCost,
      minTier: r.minTier,
      minTierLabel: r.minTier ? TIER_LABELS[r.minTier] : null,
      stock: r.stock,
      redeemedCount: r.redeemedCount,
      isActive: r.isActive,
    })),
    wheel: {
      enabled: wheel?.enabled ?? false,
      title: wheel?.title ?? 'جرّب حظك',
      prizes: prizes.map((p) => ({ label: p.label, color: p.color, chance: p.probabilityBps / 100 })),
      /* فورم العجلة في التطبيق (من 2.5) — نفس خانات فورم اللوحة */
      subtitle: wheel?.subtitle ?? '',
      triggerAfterSeconds: wheel?.triggerAfterSeconds ?? 15,
      freeSpinsPerDay: wheel?.freeSpinsPerDay ?? 1,
      prizeInputs: wheelPrizeInputs(prizes).map(({ label, color, type, value, chance }) => ({ label, color, type, value, chance })),
    },
    /* التطبيق من 2.5 بيعدّل المستويات والعجلة لو ده موجود */
    editsTiers: true,
    recent: recent.map((t) => ({
      id: t.id,
      points: t.points,
      reason: t.reason,
      customerName: t.customerName,
      createdAt: t.createdAt.toISOString(),
    })),
  }
}
