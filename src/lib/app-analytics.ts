import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import { loadAnalytics, pctChange } from '@/lib/analytics-data'
import { statusMeta } from '@/lib/order-status'

/** شكل التحليلات اللي تطبيق الموبايل بيستلمه — المبالغ بالوحدة الصغرى */
export async function analyticsPayload(store: ActiveStore) {
  const a = await loadAnalytics(store)

  return {
    currency: store.currency,
    kpis: [
      { key: 'revenue', label: 'إيرادات ٣٠ يوم', value: a.revCur, money: true, change: pctChange(a.revCur, a.revPrev) },
      { key: 'orders', label: 'الطلبات', value: a.ordCur, money: false, change: pctChange(a.ordCur, a.ordPrev) },
      { key: 'aov', label: 'متوسط قيمة الطلب', value: a.aovCur, money: true, change: pctChange(a.aovCur, a.aovPrev) },
      { key: 'net', label: 'صافي الربح', value: a.netCur, money: true, change: pctChange(a.netCur, a.netPrev) },
    ],
    /* نفس شرط الصفحة: فيه مبيعات ومفيش مصروفات مسجّلة — «صافي الربح» متفائل */
    expensesMissing: a.spendCur === 0 && a.revCur > 0,
    series: a.series,
    statuses: [...a.statusRows]
      .sort((x, y) => y.n - x.n)
      .map((s) => {
        const meta = statusMeta(s.status)
        return {
          key: s.status,
          label: meta.label,
          n: s.n,
          pct: a.totalStatus ? Math.round((s.n / a.totalStatus) * 100) : 0,
          color: meta.fg,
        }
      }),
    top: a.topProducts.map((p) => ({ name: p.name, sold: p.sold, pct: Math.round((p.sold / a.maxSold) * 100) })),
    funnel: {
      dayCount: a.funnel.dayCount,
      steps: [
        { label: 'زوّار', value: a.funnel.visitors },
        { label: 'شافوا منتج', value: a.funnel.productViews },
        { label: 'ضافوا للسلة', value: a.funnel.addToCarts },
        { label: 'بدأوا الشيك أوت', value: a.funnel.checkoutsStarted },
        { label: 'أتمّوا الطلب', value: a.funnel.orders },
      ],
    },
  }
}
