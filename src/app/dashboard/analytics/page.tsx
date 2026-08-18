import { and, desc, eq, gt, sql } from 'drizzle-orm'
import { ArrowDownRight, ArrowUpRight, BarChart3, TrendingUp } from 'lucide-react'
import { db } from '@/db'
import { orders, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { formatMoney } from '@/lib/utils'
import { statusMeta } from '@/lib/order-status'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { RevenueChart } from './revenue-chart'

export const metadata = { title: 'التحليلات' }

// طلب حقيقي محسوب في الإيراد — مش ناقص ولا ملغي ولا مرتجع
const realOrder = sql`is_incomplete = false and status not in ('cancelled','returned')`

function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return cur > 0 ? 100 : null
  return Math.round(((cur - prev) / prev) * 100)
}

export default async function AnalyticsPage() {
  const { store } = await getDashboardContext()
  const sid = store.id

  const [[kpi], daily, statusRows, topProducts] = await Promise.all([
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
  ])

  const revCur = Number(kpi?.revCur ?? 0)
  const ordCur = Number(kpi?.ordCur ?? 0)
  const profitCur = Number(kpi?.profitCur ?? 0)
  const aovCur = ordCur > 0 ? Math.round(revCur / ordCur) : 0
  const aovPrev = Number(kpi?.ordPrev ?? 0) > 0 ? Math.round(Number(kpi.revPrev) / Number(kpi.ordPrev)) : 0

  const kpis = [
    { label: 'إيرادات ٣٠ يوم', value: formatMoney(revCur, store.currency), change: pctChange(revCur, Number(kpi?.revPrev ?? 0)) },
    { label: 'الطلبات', value: String(ordCur), change: pctChange(ordCur, Number(kpi?.ordPrev ?? 0)) },
    { label: 'متوسط قيمة الطلب', value: formatMoney(aovCur, store.currency), change: pctChange(aovCur, aovPrev) },
    { label: 'ربح تقديري', value: formatMoney(profitCur, store.currency), change: pctChange(profitCur, Number(kpi?.profitPrev ?? 0)) },
  ]

  // نبني ١٤ خانة يوم ونملا القيم — الأيام الفاضية تبقى صفر بدل ما تختفي
  const byDay = new Map(daily.map((d) => [d.day, Number(d.value)]))
  const series = Array.from({ length: 14 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - (13 - i))
    const key = d.toISOString().slice(0, 10)
    return { label: `${d.getDate()}/${d.getMonth() + 1}`, value: byDay.get(key) ?? 0 }
  })
  const hasRevenue = series.some((s) => s.value > 0)

  const totalStatus = statusRows.reduce((n, s) => n + s.n, 0)
  const maxSold = Math.max(1, ...topProducts.map((p) => p.sold))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="التحليلات" description="أداء متجرك في آخر ٣٠ يوم." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <Reveal key={k.label} delay={i * 60}>
            <Card className="flex flex-col gap-1.5 p-4">
              <span className="text-xs text-[var(--fg-muted)]">{k.label}</span>
              <span className="tabular text-xl font-bold tracking-tight">{k.value}</span>
              {k.change !== null && (
                <span
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{ color: k.change >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}
                >
                  {k.change >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(k.change)}%
                  <span className="text-[var(--fg-subtle)]">عن الشهر اللي فات</span>
                </span>
              )}
            </Card>
          </Reveal>
        ))}
      </div>

      <Reveal delay={100}>
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
            <h2 className="font-semibold">الإيرادات — آخر ١٤ يوم</h2>
          </div>
          {hasRevenue ? (
            <RevenueChart data={series} currency={store.currency} />
          ) : (
            <p className="py-10 text-center text-sm text-[var(--fg-muted)]">
              مافيش مبيعات في آخر ١٤ يوم. أول ما تيجي طلبات هتشوفها هنا.
            </p>
          )}
        </Card>
      </Reveal>

      <div className="grid gap-4 lg:grid-cols-2">
        <Reveal>
          <Card className="flex h-full flex-col gap-4 p-5">
            <h2 className="font-semibold">توزيع الطلبات</h2>
            {totalStatus === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--fg-muted)]">لسه مافيش طلبات.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {statusRows
                  .sort((a, b) => b.n - a.n)
                  .map((s) => {
                    const meta = statusMeta(s.status)
                    const pct = Math.round((s.n / totalStatus) * 100)
                    return (
                      <div key={s.status} className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{meta.label}</span>
                          <span className="tabular text-[var(--fg-muted)]">
                            {s.n} · {pct}%
                          </span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: meta.fg }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </Card>
        </Reveal>

        <Reveal delay={80}>
          <Card className="flex h-full flex-col gap-4 p-5">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[var(--primary)]" aria-hidden="true" />
              <h2 className="font-semibold">الأكثر مبيعًا</h2>
            </div>
            {topProducts.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--fg-muted)]">لسه مافيش مبيعات.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {topProducts.map((p) => (
                  <div key={p.name} className="flex flex-col gap-1">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <span className="tabular shrink-0 text-[var(--fg-muted)]">{p.sold} قطعة</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
                      <div
                        className="h-full rounded-full bg-[var(--primary)]"
                        style={{ width: `${Math.round((p.sold / maxSold) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Reveal>
      </div>

      <Reveal>
        <p className="text-xs text-[var(--fg-subtle)]">
          «ربح تقديري» = المبيعات ناقص تكلفة المنتجات (اللي دخلتها في كل منتج). أضف تكلفة كل منتج عشان
          الرقم يبقى دقيق.
        </p>
      </Reveal>
    </div>
  )
}
