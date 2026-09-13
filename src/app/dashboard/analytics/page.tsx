import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, BarChart3, TrendingUp, Wallet } from 'lucide-react'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { formatMoney } from '@/lib/utils'
import { statusMeta } from '@/lib/order-status'
import { loadAnalytics, pctChange } from '@/lib/analytics-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { RevenueChart } from './revenue-chart'
import { Funnel } from './funnel'

export const metadata = { title: 'التحليلات' }

export default async function AnalyticsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'reports.view')

  /* الاستعلامات في `src/lib/analytics-data.ts` — تطبيق الموبايل بيقرا نفس الأرقام */
  const a = await loadAnalytics(store)
  const { revCur, ordCur, spendCur, funnel, series, hasRevenue, statusRows, totalStatus, topProducts, maxSold } = a

  const kpis = [
    { label: 'إيرادات ٣٠ يوم', value: formatMoney(revCur, store.currency), change: pctChange(revCur, a.revPrev) },
    { label: 'الطلبات', value: String(ordCur), change: pctChange(ordCur, a.ordPrev) },
    { label: 'متوسط قيمة الطلب', value: formatMoney(a.aovCur, store.currency), change: pctChange(a.aovCur, a.aovPrev) },
    /*
      «صافي الربح» لا «ربح تقديري».

      الاسم القديم كان بيوصف رقمًا ناقصًا: مجمل ربح بعد تكلفة البضاعة
      وبس. دلوقتي المصروفات المسجّلة داخلة فيه، فبقى الرقم اللي التاجر
      بيقرّر بيه — ولو مسجّلش مصروفات، السطر تحته بيقوله ليه الرقم
      ده متفائل.
    */
    {
      label: 'صافي الربح',
      value: formatMoney(a.netCur, store.currency),
      change: pctChange(a.netCur, a.netPrev),
    },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="التحليلات" description="أداء متجرك في آخر ٣٠ يوم." />

      {/*
        التنبيه ده بيظهر لما مفيش مصروفات مسجّلة خالص.

        من غيره، «صافي الربح» بيساوي مجمل الربح والتاجر بيصدّقه —
        وهو ده بالظبط الرقم اللي بيخلّي تاجر يفضل يصرف على إعلانات
        خاسرة وهو فاكر نفسه رابح.
      */}
      {spendCur === 0 && revCur > 0 && (
        <Reveal>
          <Link href="/dashboard/expenses" className="block">
            <Card className="flex items-center gap-3 border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4 transition-opacity hover:opacity-90">
              <Wallet
                className="h-5 w-5 shrink-0 text-[var(--color-warning)]"
                aria-hidden="true"
              />
              <span className="flex-1 text-sm">
                <span className="font-semibold text-[var(--color-warning)]">
                  «صافي الربح» تحت لسه ما فيهوش إعلاناتك ولا إيجارك
                </span>
                <span className="mt-0.5 block text-[var(--fg-muted)]">
                  سجّل مصروفاتك عشان الرقم يبقى حقيقي
                </span>
              </span>
            </Card>
          </Link>
        </Reveal>
      )}

      <Reveal>
        <Funnel data={funnel} />
      </Reveal>

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
                {[...statusRows]
                  .sort((x, y) => y.n - x.n)
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
