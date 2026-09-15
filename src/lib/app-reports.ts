import 'server-only'
import type { DashboardContext } from '@/lib/store-context'
import { can } from '@/lib/permissions'
import { liveSnapshot } from '@/lib/live-view'
import {
  carrierPerformance,
  channelLabel,
  salesByChannel,
  salesBySource,
  sessionsBySource,
  teamActivity,
} from '@/lib/reports'
import { mediumLabel, sourceLabel } from '@/lib/attribution'
import { carrierMeta } from '@/lib/carriers'
import { signalQuality } from '@/lib/signal-quality'
import { capiConfigured } from '@/lib/capi'

/**
 * شاشات «العرض المباشر» و«تقارير مفصّلة» و«جودة إشارة التحويل» في التطبيق (والمساعد).
 * نفس اللودرات اللي صفحات اللوحة بتستخدمها بالظبط — والأرقام المالية بتتشال للي مالوش `finance.view`
 * من الخادم نفسه (مش بتتخبّى في الشاشة بس).
 */

export async function livePayload(ctx: DashboardContext) {
  const snap = await liveSnapshot(ctx.store.id)
  /* نفس شرط صفحة العرض المباشر */
  const showMoney = ctx.actor.role === 'owner' || ctx.actor.permissions.includes('finance.view')
  return {
    ...snap,
    revenueHour: showMoney ? snap.revenueHour : 0,
    feed: snap.feed.map((e) => ({ ...e, value: showMoney ? e.value : null })),
    currency: ctx.store.currency,
    showMoney,
  }
}

export async function reportsPayload(ctx: DashboardContext) {
  const showMoney = can(ctx.actor, 'finance.view')
  const storeId = ctx.store.id
  const [channels, sources, sessions, carriers, team] = await Promise.all([
    salesByChannel(storeId),
    salesBySource(storeId),
    sessionsBySource(storeId),
    carrierPerformance(storeId),
    teamActivity(storeId),
  ])
  const sessionsBy = new Map(sessions.map((s) => [s.source, s.sessions]))

  return {
    currency: ctx.store.currency,
    showMoney,
    channels: channels.map((c) => ({
      label: channelLabel(c.key),
      orders: c.orders,
      revenue: showMoney ? c.revenue : null,
      refused: c.refused,
    })),
    sources: sources.map((s) => {
      const visits = sessionsBy.get(s.source) ?? 0
      const medium = mediumLabel(s.medium)
      return {
        label: medium ? `${sourceLabel(s.source)} · ${medium}` : sourceLabel(s.source),
        visits,
        orders: s.orders,
        revenue: showMoney ? s.revenue : null,
        rate: visits > 0 ? Math.round((s.orders / visits) * 1000) / 10 : null,
      }
    }),
    carriers: carriers.map((c) => ({
      label: carrierMeta(c.carrier).label,
      shipments: c.shipments,
      rate: c.shipments > 0 ? Math.round((c.delivered / c.shipments) * 100) : 0,
      failed: c.failed,
      avgDays: c.avgDays,
      codTotal: showMoney ? c.codTotal : null,
      codSettled: showMoney ? c.codSettled : null,
    })),
    team: team.map((t) => ({
      name: t.name,
      ordersCreated: t.ordersCreated,
      revenue: showMoney ? t.revenue : null,
      statusChanges: t.statusChanges,
    })),
  }
}

export async function signalPayload(storeId: string) {
  const [snap, configured] = await Promise.all([signalQuality(storeId), capiConfigured(storeId)])
  return { ...snap, configured }
}
