import 'server-only'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, orders } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import { loadTrustScore } from '@/lib/trust-score'

/**
 * بيانات العملاء — مصدر واحد لصفحة العملاء في اللوحة ولتطبيق الموبايل.
 */

export const CUSTOMER_TIERS: Record<string, { label: string; bg: string; fg: string }> = {
  bronze: { label: 'برونزي', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
  silver: { label: 'فضي', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
  gold: { label: 'ذهبي', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  platinum: { label: 'بلاتيني', bg: 'var(--primary-soft)', fg: 'var(--primary)' },
}

export async function loadCustomersList(store: ActiveStore, filter: string | undefined) {
  const subscribersOnly = filter === 'subscribers'
  const where = subscribersOnly
    ? and(
        eq(customers.storeId, store.id),
        eq(customers.acceptsMarketing, true),
        sql`${customers.email} is not null and ${customers.email} <> ''`,
      )
    : eq(customers.storeId, store.id)

  const [rows, [totals]] = await Promise.all([
    db
      .select({
        id: customers.id,
        name: customers.name,
        phone: customers.phone,
        email: customers.email,
        ordersCount: customers.ordersCount,
        totalSpent: customers.totalSpent,
        lastOrderAt: customers.lastOrderAt,
        tier: customers.tier,
        createdAt: customers.createdAt,
      })
      .from(customers)
      .where(where)
      .orderBy(desc(customers.totalSpent), desc(customers.createdAt))
      .limit(200),
    db
      .select({
        count: sql<number>`count(*)::int`,
        revenue: sql<number>`coalesce(sum(${customers.totalSpent}), 0)::int`,
        repeat: sql<number>`count(*) filter (where ${customers.ordersCount} > 1)::int`,
        subscribers: sql<number>`count(*) filter (
          where ${customers.acceptsMarketing} = true
            and ${customers.email} is not null
            and ${customers.email} <> ''
        )::int`,
      })
      .from(customers)
      .where(eq(customers.storeId, store.id)),
  ])

  const average = totals.count > 0 ? Math.round(totals.revenue / totals.count) : 0
  const repeatRate = totals.count > 0 ? Math.round((totals.repeat / totals.count) * 100) : 0

  return { rows, totals, average, repeatRate, subscribersOnly }
}

/** عميل واحد بآخر طلباته ودرجة ثقته — لشاشة العميل في التطبيق */
export async function loadCustomerDetail(store: ActiveStore, customerId: string) {
  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, customerId), eq(customers.storeId, store.id)))
    .limit(1)

  if (!customer) return null

  const [recentOrders, trust] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        total: orders.total,
        createdAt: orders.createdAt,
      })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), eq(orders.customerId, customer.id), eq(orders.isIncomplete, false)))
      .orderBy(desc(orders.createdAt))
      .limit(20),
    loadTrustScore(store.id, customer.phone),
  ])

  return { customer, recentOrders, trust }
}
