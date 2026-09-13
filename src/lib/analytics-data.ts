import 'server-only'
import { and, desc, eq, gt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { expenses, orders, products } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import { getFunnel } from '@/lib/analytics-events'

/**
 * بيانات صفحة التحليلات — صفحة اللوحة و`/api/app/analytics` بيقروا من هنا.
 *
 * نفس الاستعلامات بالحرف اللي كانت في الصفحة، اتنقلت هنا عشان التطبيق
 * والموقع يشوفوا نفس الأرقام. أي تعديل في الحساب بيوصل للاتنين.
 */

// طلب حقيقي محسوب في الإيراد — مش ناقص ولا ملغي ولا مرتجع
const realOrder = sql`is_incomplete = false and status not in ('cancelled','returned')`

export function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? 100 : null
  return Math.round(((cur - prev) / prev) * 100)
}

export async function loadAnalytics(store: ActiveStore) {
  const sid = store.id

  const [[kpi], daily, statusRows, topProducts, funnel] = await Promise.all([
    // مؤشرات آخر ٣٠ يوم مقابل الـ٣٠ اللي قبلها — الاتنين في استعلام واحد
    db
      .select({
        revCur: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.createdAt} >= now() - interval '30 days'), 0)::bigint`,
        revPrev: sql<number>`coalesce(sum(${orders.total}) filter (where ${orders.createdAt} < now() - interval '30 days'), 0)::bigint`,
        ordCur: sql<number>`count(*) filter (where ${orders.createdAt} >= now() - interval '30 days')::int`,
        ordPrev: sql<number>`count(*) filter (where ${orders.createdAt} < now() - interval '30 days')::int`,
        profitCur: sql<number>`coalesce(sum(${orders.subtotal} - ${orders.discountTotal} - ${orders.costTotal}) filter (where ${orders.createdAt} >= now() - interval '30 days'), 0)::bigint`,
        profitPrev: sql<number>`coalesce(sum(${orders.subtotal} - ${orders.discountTotal} - ${orders.costTotal}) filter (where ${orders.createdAt} < now() - interval '30 days'), 0)::bigint`,
      })
      .from(orders)
      .where(and(eq(orders.storeId, sid), realOrder, sql`${orders.createdAt} >= now() - interval '60 days'`)),

    // إيراد كل يوم في آخر ١٤ يوم
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${orders.createdAt}), 'YYYY-MM-DD')`,
        value: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`,
      })
      .from(orders)
      .where(and(eq(orders.storeId, sid), realOrder, sql`${orders.createdAt} >= now() - interval '13 days'`))
      .groupBy(sql`date_trunc('day', ${orders.createdAt})`),

    // توزيع الطلبات حسب الحالة
    db
      .select({ status: orders.status, n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.storeId, sid), sql`is_incomplete = false`))
      .groupBy(orders.status),

    // أكثر المنتجات مبيعًا
    db
      .select({ name: products.name, sold: products.soldCount })
      .from(products)
      .where(and(eq(products.storeId, sid), gt(products.soldCount, 0)))
      .orderBy(desc(products.soldCount))
      .limit(6),

    getFunnel(sid, 30),
  ])

  /**
   * المصروفات — الفرق بين «ربح تقديري» و«صافي الربح».
   *
   * الرقم اللي فوق (`profitCur`) بيطرح تكلفة البضاعة بس. التاجر
   * اللي بيصرف على إعلانات بيبص عليه ويفتكر نفسه رابح، وآخر الشهر
   * يلاقي الفلوس مش موجودة. الاستعلام ده بيقفل الفجوة دي.
   *
   * استعلامين منفصلين لا `join`: المصروف مالوش أي علاقة بالطلب،
   * والضم كان هيضرب الصفوف في بعض ويطلّع مجموعًا مضاعفًا.
   */
  const [[spend], [spendPrev]] = await Promise.all([
    db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint` })
      .from(expenses)
      .where(and(eq(expenses.storeId, sid), sql`${expenses.spentAt} >= now() - interval '30 days'`)),
    db
      .select({ total: sql<number>`coalesce(sum(${expenses.amount}), 0)::bigint` })
      .from(expenses)
      .where(
        and(
          eq(expenses.storeId, sid),
          sql`${expenses.spentAt} >= now() - interval '60 days'`,
          sql`${expenses.spentAt} < now() - interval '30 days'`,
        ),
      ),
  ])

  const revCur = Number(kpi?.revCur ?? 0)
  const revPrev = Number(kpi?.revPrev ?? 0)
  const ordCur = Number(kpi?.ordCur ?? 0)
  const ordPrev = Number(kpi?.ordPrev ?? 0)
  const profitCur = Number(kpi?.profitCur ?? 0)
  const aovCur = ordCur > 0 ? Math.round(revCur / ordCur) : 0
  const aovPrev = ordPrev > 0 ? Math.round(revPrev / ordPrev) : 0

  const spendCur = Number(spend?.total ?? 0)
  const netCur = profitCur - spendCur
  const netPrev = Number(kpi?.profitPrev ?? 0) - Number(spendPrev?.total ?? 0)

  // نبني ١٤ خانة يوم ونملا القيم — الأيام الفاضية تبقى صفر بدل ما تختفي
  const byDay = new Map(daily.map((d) => [d.day, Number(d.value)]))
  const series = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const key = d.toISOString().slice(0, 10)
    return { label: `${d.getDate()}/${d.getMonth() + 1}`, value: byDay.get(key) ?? 0 }
  })

  return {
    revCur,
    revPrev,
    ordCur,
    ordPrev,
    aovCur,
    aovPrev,
    spendCur,
    netCur,
    netPrev,
    series,
    hasRevenue: series.some((s) => s.value > 0),
    statusRows,
    totalStatus: statusRows.reduce((n, s) => n + s.n, 0),
    topProducts,
    maxSold: Math.max(1, ...topProducts.map((p) => p.sold)),
    funnel,
  }
}
