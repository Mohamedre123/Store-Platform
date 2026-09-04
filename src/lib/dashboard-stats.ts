import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/db'

/**
 * أرقام الصفحة الرئيسية.
 *
 * ## استعلامان لكل حاجة — مش أربعتاشر
 * الصفحة محتاجة ١٤ يوم لكل مقياس، ومقارنة بالـ١٤ اللي قبلهم. استعلام
 * لكل يوم معناه ٢٨ رحلة على صفحة بتتفتح كل صباح. التجميع بـ
 * `generate_series` بيرجّع الأيام كلها في نداء واحد، **ومعاها الأيام
 * الفاضية**: من غيرها الرسم بيوصّل يوم السبت بيوم الاتنين ويبان
 * كأن الأحد ما كانش موجود.
 *
 * ## وتعريف «الطلب الحقيقي» واحد
 * الناقص مش طلب، والملغي والمرتجع مش إيراد. نفس التعريف اللي في
 * التحليلات والتقارير بالحرف — الشاشتين اللي بيقولوا رقمين مختلفين
 * لنفس اليوم بيخلّوا التاجر يبطّل يثق في الاتنين.
 */

const REAL_ORDER = sql`o.is_incomplete = false and o.status not in ('cancelled','returned')`

export type DayPoint = {
  day: string
  label: string
  sessions: number
  revenue: number
  orders: number
  /** نقاط أساس — 250 = 2.5% */
  conversion: number
}

export type PeriodTotals = {
  sessions: number
  revenue: number
  orders: number
  conversionBps: number
}

export type DashboardStats = {
  series: DayPoint[]
  current: PeriodTotals
  previous: PeriodTotals
}

/** «٥/٩» — اليوم والشهر بس، الرسم مالوش مكان لسنة */
function shortLabel(day: string): string {
  const [, m, d] = day.split('-')
  return `${Number(d)}/${Number(m)}`
}

export async function loadDashboardStats(
  storeId: string,
  days = 14,
): Promise<DashboardStats> {
  const [orderRows, sessionRows, prevRows] = await Promise.all([
    /* الطلبات والإيراد لكل يوم — مع الأيام الفاضية */
    db.execute<{ day: string; orders: number; revenue: number }>(sql`
      select
        to_char(d.day, 'YYYY-MM-DD')                as day,
        count(o.id)::int                            as orders,
        coalesce(sum(o.total), 0)::bigint           as revenue
      from generate_series(
        (now() - (${days - 1} || ' days')::interval)::date,
        now()::date,
        '1 day'
      ) as d(day)
      left join orders o
        on o.store_id = ${storeId}
       and o.created_at >= d.day
       and o.created_at <  d.day + interval '1 day'
       and ${REAL_ORDER}
      group by d.day
      order by d.day
    `),

    /* الزيارات بالجلسات المميّزة — الزائر اللي فتح عشر صفحات واحد */
    db.execute<{ day: string; sessions: number }>(sql`
      select
        to_char(d.day, 'YYYY-MM-DD')                     as day,
        count(distinct e.session_id)::int                as sessions
      from generate_series(
        (now() - (${days - 1} || ' days')::interval)::date,
        now()::date,
        '1 day'
      ) as d(day)
      left join store_events e
        on e.store_id = ${storeId}
       and e.created_at >= d.day
       and e.created_at <  d.day + interval '1 day'
      group by d.day
      order by d.day
    `),

    /* المدة السابقة كرقم واحد — المقارنة مش محتاجة تفصيل يومي */
    db.execute<{ orders: number; revenue: number; sessions: number }>(sql`
      select
        (select count(*)::int from orders o
          where o.store_id = ${storeId}
            and ${REAL_ORDER}
            and o.created_at >= now() - (${days * 2} || ' days')::interval
            and o.created_at <  now() - (${days} || ' days')::interval
        ) as orders,
        (select coalesce(sum(o.total), 0)::bigint from orders o
          where o.store_id = ${storeId}
            and ${REAL_ORDER}
            and o.created_at >= now() - (${days * 2} || ' days')::interval
            and o.created_at <  now() - (${days} || ' days')::interval
        ) as revenue,
        (select count(distinct e.session_id)::int from store_events e
          where e.store_id = ${storeId}
            and e.created_at >= now() - (${days * 2} || ' days')::interval
            and e.created_at <  now() - (${days} || ' days')::interval
        ) as sessions
    `),
  ])

  const sessionsBy = new Map([...sessionRows].map((r) => [r.day, r.sessions]))

  const series: DayPoint[] = [...orderRows].map((r) => {
    const sessions = sessionsBy.get(r.day) ?? 0
    const orders = r.orders
    return {
      day: r.day,
      label: shortLabel(r.day),
      sessions,
      revenue: Number(r.revenue),
      orders,
      /*
        نسبة التحويل اليومية بتتحسب من زيارات اليوم نفسه.

        الزائر ممكن يزور النهارده ويطلب بكرة، فالنسبة اليومية تقريبية
        بطبيعتها. لكنها بتفضل مفيدة كاتجاه — واللي محتاج الدقة بيبص
        على نسبة المدة كلها تحت.
      */
      conversion: sessions > 0 ? Math.round((orders / sessions) * 10000) : 0,
    }
  })

  const current: PeriodTotals = {
    sessions: series.reduce((n, d) => n + d.sessions, 0),
    revenue: series.reduce((n, d) => n + d.revenue, 0),
    orders: series.reduce((n, d) => n + d.orders, 0),
    conversionBps: 0,
  }
  current.conversionBps =
    current.sessions > 0 ? Math.round((current.orders / current.sessions) * 10000) : 0

  const p = [...prevRows][0]
  const previous: PeriodTotals = {
    sessions: p?.sessions ?? 0,
    revenue: Number(p?.revenue ?? 0),
    orders: p?.orders ?? 0,
    conversionBps: 0,
  }
  previous.conversionBps =
    previous.sessions > 0 ? Math.round((previous.orders / previous.sessions) * 10000) : 0

  return { series, current, previous }
}

/**
 * نسبة التغيّر بين مدتين.
 *
 * بترجّع `null` لما المدة السابقة صفر: «+100%» على متجر أول أسبوع له
 * رقم مالوش معنى — والتاجر بيفتكر إنه ضاعف حاجة وهو لسه بادئ.
 */
export function pctChange(cur: number, prev: number): number | null {
  if (prev === 0) return null
  return Math.round(((cur - prev) / prev) * 100)
}
