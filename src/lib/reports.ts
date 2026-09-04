import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/db'

/**
 * تقارير التاجر.
 *
 * ## كلها بنفس تعريف «الطلب الحقيقي»
 * الناقص مش طلب، والملغي والمرتجع مش إيراد. لو كل تقرير عرّفها
 * بطريقته، التاجر بيفتح شاشتين ويلاقي رقمين مختلفين لنفس الشهر
 * ويبطّل يثق في الاتنين. التعريف هنا مرة واحدة.
 *
 * ## والاستعلامات مجمّعة لا مصفوفة
 * كل تقرير استعلام واحد بيرجّع سطورًا جاهزة للعرض. جلب الطلبات
 * وتجميعها في الذاكرة بيشتغل على متجر فيه مية طلب وبيقع على اللي
 * فيه مية ألف.
 */

/** طلب حقيقي محسوب في الإيراد — نفس تعريف صفحة التحليلات بالحرف */
const REAL_ORDER = sql`o.is_incomplete = false and o.status not in ('cancelled','returned')`

export type ChannelRow = {
  key: string
  orders: number
  revenue: number
  /** الطلبات اللي اترفضت أو اترجعت — الجودة مش الكمية */
  refused: number
}

/**
 * المبيعات حسب **قناة البيع** — الشيك أوت، الدفع السريع، اليدوي…
 *
 * ده غير المصدر: القناة هي الشاشة اللي الطلب اتعمل منها، والمصدر
 * هو الإعلان اللي جاب العميل. التاجر بيسأل السؤالين وبيحتاج
 * إجابتين مختلفتين.
 */
export async function salesByChannel(storeId: string, days = 30): Promise<ChannelRow[]> {
  const rows = await db.execute<{
    key: string
    orders: number
    revenue: number
    refused: number
  }>(sql`
    select
      coalesce(o.source, 'storefront')                       as key,
      count(*) filter (where ${REAL_ORDER})::int             as orders,
      coalesce(sum(o.total) filter (where ${REAL_ORDER}), 0)::bigint as revenue,
      count(*) filter (
        where o.is_incomplete = false
          and (o.status = 'returned'
               or (o.status = 'cancelled' and o.confirmed_at is not null))
      )::int                                                 as refused
    from orders o
    where o.store_id = ${storeId}
      and o.created_at >= now() - (${days} || ' days')::interval
      and o.is_incomplete = false
    group by 1
    order by 3 desc
  `)

  return [...rows].map((r) => ({
    key: r.key,
    orders: r.orders,
    revenue: Number(r.revenue),
    refused: r.refused,
  }))
}

export type SourceRow = {
  source: string
  medium: string | null
  orders: number
  revenue: number
}

/**
 * المبيعات حسب **مصدر الزيارة** — الإعلان اللي جاب العميل.
 *
 * بيقرا من `orders.utm` اللي بيتكتب من كوكي الإسناد. الطلبات اللي
 * اتعملت قبل ما الالتقاط يشتغل مالهاش وسوم، وبتظهر تحت «مباشر» —
 * وده صادق: إحنا فعلًا ما نعرفش جت منين.
 */
export async function salesBySource(storeId: string, days = 30): Promise<SourceRow[]> {
  const rows = await db.execute<{
    source: string
    medium: string | null
    orders: number
    revenue: number
  }>(sql`
    select
      coalesce(nullif(o.utm->>'source', ''), 'direct') as source,
      nullif(o.utm->>'medium', '')                     as medium,
      count(*)::int                                    as orders,
      coalesce(sum(o.total), 0)::bigint                as revenue
    from orders o
    where o.store_id = ${storeId}
      and o.created_at >= now() - (${days} || ' days')::interval
      and ${REAL_ORDER}
    group by 1, 2
    order by 4 desc
    limit 30
  `)

  return [...rows].map((r) => ({
    source: r.source,
    medium: r.medium,
    orders: r.orders,
    revenue: Number(r.revenue),
  }))
}

export type SessionSourceRow = { source: string; sessions: number }

/**
 * الزيارات حسب المصدر — بالجلسات المميّزة لا بعدد الأحداث.
 *
 * الزائر اللي فتح عشر صفحات زائر واحد. عدّ الأحداث بيخلّي كل تقرير
 * يبان أحسن خمس مرات من الحقيقة، ونسبة التحويل تطلع مضروبة.
 */
export async function sessionsBySource(storeId: string, days = 30): Promise<SessionSourceRow[]> {
  const rows = await db.execute<{ source: string; sessions: number }>(sql`
    select
      coalesce(nullif(e.utm->>'source', ''), 'direct') as source,
      count(distinct e.session_id)::int                as sessions
    from store_events e
    where e.store_id = ${storeId}
      and e.created_at >= now() - (${days} || ' days')::interval
    group by 1
    order by 2 desc
    limit 30
  `)

  return [...rows].map((r) => ({ source: r.source, sessions: r.sessions }))
}

export type CarrierRow = {
  carrier: string
  shipments: number
  delivered: number
  failed: number
  /** المحصَّل عند الاستلام واللي التاجر استلمه فعلًا */
  codTotal: number
  codSettled: number
  /** متوسط أيام التوصيل — من إنشاء الشحنة للتسليم */
  avgDays: number | null
}

/**
 * أداء شركات الشحن.
 *
 * ## أهم رقم هنا مش عدد الشحنات
 * **نسبة التسليم**. التاجر بيختار شركة على أساس السعر، والشركة اللي
 * بتوصّل ٧٠٪ بس بتكلّفه أضعاف الفرق في السعر — شحن رايح وجاي على كل
 * طلب مرفوض، وبضاعة راجعة، وعميل زعلان.
 *
 * والمحصَّل مقابل المسدَّد بيقول حاجة تانية: الشركة اللي بتوصّل كويس
 * وبتتأخر في التوريد بتقفل السيولة عند التاجر.
 *
 * ## متوسط أيام التوصيل تقريبي عن قصد
 * بيتحسب من إنشاء الشحنة لآخر تحديث على الشحنة المسلَّمة —
 * `updatedAt` هو أقرب حاجة عندنا لوقت التسليم، لأن الويب هوك بيحدّث
 * الصف لما الشركة تبلّغ. مش دقيق للساعة، لكنه بيفرّق بين شركة بتوصّل
 * في يومين وواحدة بتوصّل في تمنية — وده السؤال اللي التاجر بيسأله.
 */
export async function carrierPerformance(storeId: string, days = 90): Promise<CarrierRow[]> {
  const rows = await db.execute<{
    carrier: string
    shipments: number
    delivered: number
    failed: number
    cod_total: number
    cod_settled: number
    avg_days: number | null
  }>(sql`
    select
      s.carrier,
      count(*)::int                                                       as shipments,
      count(*) filter (where s.status = 'delivered')::int                 as delivered,
      count(*) filter (where s.status in ('failed','returned'))::int      as failed,
      coalesce(sum(s.cod_amount), 0)::bigint                              as cod_total,
      coalesce(sum(s.cod_amount) filter (where s.is_cod_collected), 0)::bigint as cod_settled,
      -- متوسط أيام التوصيل (الشرح فوق في تعليق الدالة)
      avg(
        extract(epoch from (s.updated_at - s.created_at)) / 86400
      ) filter (where s.status = 'delivered')                             as avg_days
    from shipments s
    where s.store_id = ${storeId}
      and s.created_at >= now() - (${days} || ' days')::interval
    group by 1
    order by 2 desc
  `)

  return [...rows].map((r) => ({
    carrier: r.carrier,
    shipments: r.shipments,
    delivered: r.delivered,
    failed: r.failed,
    codTotal: Number(r.cod_total),
    codSettled: Number(r.cod_settled),
    avgDays: r.avg_days === null ? null : Math.round(Number(r.avg_days) * 10) / 10,
  }))
}

export type TeamRow = {
  userId: string | null
  name: string
  /** طلبات سجّلها بإيده */
  ordersCreated: number
  revenue: number
  /** تغييرات حالة عملها — قياس الشغل اليومي مش البيع بس */
  statusChanges: number
}

/**
 * شغل الفريق.
 *
 * ## بيقرا من `order_events` لا من عمود على الطلب
 * الحدث بيسجّل مين عمل إيه وإمتى وهو أصلًا موجود لكل تغيير. عمود
 * «الموظف» على الطلب كان هيجاوب على سؤال واحد بس (مين سجّله)،
 * والحدث بيجاوب على الاتنين — مين سجّله ومين شغّال عليه بعد كده.
 *
 * ## والموظف اللي مشي بيفضل ظاهر
 * العضوية بتتوقف ما بتتحذفش، فالضمّ بيلاقي اسمه. لو اتحذف الصف،
 * شغل الشهر اللي فات كان بيتنسب لـ«—» بلا أي تفسير.
 */
export async function teamActivity(storeId: string, days = 30): Promise<TeamRow[]> {
  const rows = await db.execute<{
    user_id: string | null
    name: string | null
    orders_created: number
    revenue: number
    status_changes: number
  }>(sql`
    select
      e.actor_id                                                       as user_id,
      u.name                                                           as name,
      count(*) filter (where e.type = 'created')::int                   as orders_created,
      coalesce(sum(o.total) filter (where e.type = 'created' and ${REAL_ORDER}), 0)::bigint as revenue,
      count(*) filter (where e.type = 'status_changed')::int            as status_changes
    from order_events e
    join orders o on o.id = e.order_id
    left join users u on u.id = e.actor_id
    where e.store_id = ${storeId}
      and e.actor_type = 'merchant'
      and e.actor_id is not null
      and e.created_at >= now() - (${days} || ' days')::interval
    group by 1, 2
    order by 3 desc, 5 desc
    limit 50
  `)

  return [...rows].map((r) => ({
    userId: r.user_id,
    name: r.name ?? 'عضو محذوف',
    ordersCreated: r.orders_created,
    revenue: Number(r.revenue),
    statusChanges: r.status_changes,
  }))
}

/** اسم قناة البيع بالعربي */
export const CHANNEL_LABELS: Record<string, string> = {
  storefront: 'الشيك أوت',
  quick_checkout: 'الدفع السريع',
  funnel: 'صفحة هبوط',
  whatsapp: 'واتساب',
  manual: 'طلب يدوي',
  api: 'API',
  marketplace: 'سوق خارجي',
}

export function channelLabel(key: string): string {
  return CHANNEL_LABELS[key] ?? key
}
