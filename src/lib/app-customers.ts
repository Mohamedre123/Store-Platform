import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { CUSTOMER_TIERS, loadCustomerDetail, loadCustomersList } from '@/lib/customers-data'
import { formatOrderNumber } from '@/lib/order-number'
import { statusMeta } from '@/lib/order-status'
import { TRUST_META } from '@/lib/trust-score'

/** شكل العملاء اللي تطبيق الموبايل بيستلمه — المبالغ بالوحدة الصغرى والتواريخ ISO */

const tierLabel = (tier: string) => (CUSTOMER_TIERS[tier] ?? CUSTOMER_TIERS.bronze).label

const greetingText = (store: ActiveStore, name: string | null) => `مرحبًا${name ? ' ' + name : ''}، معاك ${store.name}`

export async function customersListPayload(store: ActiveStore, filter: string | undefined) {
  const data = await loadCustomersList(store, filter)

  return {
    currency: store.currency,
    filter: data.subscribersOnly ? 'subscribers' : 'all',
    totals: {
      count: data.totals.count,
      subscribers: data.totals.subscribers,
      average: data.average,
      repeatRate: data.repeatRate,
    },
    customers: data.rows.map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      ordersCount: c.ordersCount,
      totalSpent: c.totalSpent,
      lastOrderAt: c.lastOrderAt ? c.lastOrderAt.toISOString() : null,
      tier: c.tier,
      /* نفس اللوحة: الشارة للعميل اللي رجع اشترى تاني بس */
      tierLabel: c.ordersCount > 1 ? tierLabel(c.tier) : null,
      whatsappText: greetingText(store, c.name),
    })),
  }
}

export async function customerDetailPayload(store: ActiveStore, customerId: string) {
  const detail = await loadCustomerDetail(store, customerId)
  if (!detail) return null

  const { customer: c, recentOrders, trust } = detail

  return {
    currency: store.currency,
    customer: {
      id: c.id,
      name: c.name,
      phone: c.phone,
      email: c.email,
      tier: c.tier,
      tierLabel: tierLabel(c.tier),
      points: c.points,
      ordersCount: c.ordersCount,
      totalSpent: c.totalSpent,
      averageOrder: c.ordersCount > 0 ? Math.round(c.totalSpent / c.ordersCount) : 0,
      lastOrderAt: c.lastOrderAt ? c.lastOrderAt.toISOString() : null,
      createdAt: c.createdAt.toISOString(),
      acceptsMarketing: c.acceptsMarketing,
      tags: c.tags,
      note: c.note,
      isBlocked: c.isBlocked,
    },
    orders: recentOrders.map((o) => ({
      id: o.id,
      number: formatOrderNumber(store, o.orderNumber),
      status: o.status,
      statusLabel: statusMeta(o.status).label,
      total: o.total,
      createdAt: o.createdAt.toISOString(),
    })),
    trust: c.phone
      ? {
          level: trust.level,
          label: TRUST_META[trust.level].label,
          score: trust.score,
          reasons: trust.reasons,
          networkStores: trust.network.stores,
        }
      : null,
    whatsappText: greetingText(store, c.name),
  }
}
