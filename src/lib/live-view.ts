import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/db'

/**
 * العرض المباشر — مين على المتجر دلوقتي وبيعمل إيه.
 *
 * ## ليه ده مش «تحليلات تانية»
 * صفحة التحليلات بتجاوب على «الشهر ده عامل إزاي». دي بتجاوب على
 * **«دلوقتي فيه إيه»** — وهو سؤال تاني خالص بيتسأل في وقت تاني:
 * التاجر بيفتحها وهو مطلّع إعلانًا، أو بيسأل ليه الطلبات وقفت
 * فجأة. الإجابة اللي بتوصل بعد يوم مالهاش قيمة في الحالتين.
 *
 * ## والبيانات كانت موجودة من أول يوم
 * `store_events` بيتكتب فيه كل زيارة ومشاهدة منتج وإضافة للسلة
 * وبداية شيك أوت من ساعة ما اتبنى. الجدول ده كان بيتقرا في تقرير
 * القُمع الشهري بس — وكل الأعمدة اللي بتخلّي الشاشة دي ممكنة
 * (`session_id`، `device`، `country`، `city`، `path`, `utm`)
 * كانت بتتكتب ومحدّش بيقراها.
 *
 * ## «الزائر الحالي» = جلسة عملت حاجة في آخر ٥ دقايق
 * النافذة دي هي المتعارف عليه في أدوات التحليلات، ومعقولة بشريًّا:
 * اللي فتح صفحة من ٤ دقايق غالبًا لسه بيقرا، واللي من ٢٠ دقيقة
 * سايب التاب مفتوح وراح. النافذة الأوسع كانت هتخلّي الرقم يفضل
 * عالي بعد ما الزوار يمشوا، وهو أسوأ من رقم أقل بصدق.
 */

const LIVE_WINDOW = "interval '5 minutes'"

export type LiveSnapshot = {
  /** جلسات عملت أي حاجة في آخر ٥ دقايق */
  activeNow: number
  /** جلسات آخر ساعة */
  sessionsHour: number
  /** سلات فيها منتجات ومحدّش كمّل — آخر ساعتين */
  activeCarts: number
  checkoutsHour: number
  ordersHour: number
  revenueHour: number
  byDevice: Array<{ key: string; n: number }>
  byCity: Array<{ key: string; n: number }>
  bySource: Array<{ key: string; n: number }>
  topPages: Array<{ path: string; n: number }>
  /** أحدث ما حصل — سطر لكل حدث */
  feed: Array<{
    type: string
    at: string
    path: string | null
    city: string | null
    device: string | null
    value: number | null
    productName: string | null
  }>
}

/**
 * لقطة واحدة بكل أرقام الشاشة.
 *
 * استعلام واحد كبير لا عشرة صغيرين: الصفحة بتتحدّث كل ١٥ ثانية،
 * وعشر رحلات لقاعدة البيانات كل ربع دقيقة من كل تاجر فاتح الشاشة
 * كان هياكل حدّ الاتصالات على Supavisor — وهو نفس العطل اللي
 * موصوف في PLAN تحت «عميل قاعدة البيانات».
 */
export async function liveSnapshot(storeId: string): Promise<LiveSnapshot> {
  const rows = await db.execute<{
    active_now: number
    sessions_hour: number
    active_carts: number
    checkouts_hour: number
    orders_hour: number
    revenue_hour: number
    by_device: Array<{ key: string; n: number }> | null
    by_city: Array<{ key: string; n: number }> | null
    by_source: Array<{ key: string; n: number }> | null
    top_pages: Array<{ path: string; n: number }> | null
    feed: LiveSnapshot['feed'] | null
  }>(sql`
    with recent as (
      select * from store_events
      where store_id = ${storeId} and created_at >= now() - interval '2 hours'
    ),
    live as (select * from recent where created_at >= now() - ${sql.raw(LIVE_WINDOW)}),
    hour as (select * from recent where created_at >= now() - interval '1 hour')
    select
      (select count(distinct session_id)::int from live) as active_now,
      (select count(distinct session_id)::int from hour) as sessions_hour,

      /*
        السلة النشطة = جلسة ضافت للسلة وما بدأتش شيك أوت.

        النافذة ساعتين لا خمس دقايق: الزائر بيحط في سلته ويفضل
        يتفرّج، والرقم ده هو «فيه كام سلة مفتوحة» مش «كام واحد
        بيضيف دلوقتي».
      */
      (select count(distinct a.session_id)::int
         from recent a
        where a.type = 'add_to_cart'
          and not exists (
            select 1 from recent b
             where b.session_id = a.session_id
               and b.type in ('begin_checkout','purchase')
               and b.created_at > a.created_at
          )) as active_carts,

      (select count(distinct session_id)::int from hour where type = 'begin_checkout') as checkouts_hour,
      (select count(*)::int from hour where type = 'purchase') as orders_hour,
      (select coalesce(sum(value), 0)::bigint from hour where type = 'purchase') as revenue_hour,

      (select coalesce(json_agg(x), '[]'::json) from (
         select coalesce(device, 'مش معروف') as key, count(distinct session_id)::int as n
           from hour group by 1 order by 2 desc limit 4
       ) x) as by_device,

      (select coalesce(json_agg(x), '[]'::json) from (
         select coalesce(nullif(city, ''), 'مش معروفة') as key, count(distinct session_id)::int as n
           from hour group by 1 order by 2 desc limit 8
       ) x) as by_city,

      /*
        المصدر من وسوم UTM، والفاضي «مباشر».

        utm->>'source' لأن الوسوم بتتخزّن jsonb — نفس المفتاح
        اللي تقرير المصادر بيقرا منه، فالشاشتين ما يقولوش رقمين
        مختلفين لنفس الزيارة.
      */
      (select coalesce(json_agg(x), '[]'::json) from (
         select coalesce(nullif(utm->>'source', ''), 'مباشر') as key,
                count(distinct session_id)::int as n
           from hour group by 1 order by 2 desc limit 6
       ) x) as by_source,

      (select coalesce(json_agg(x), '[]'::json) from (
         select path, count(*)::int as n
           from hour where path is not null and path <> '' group by 1 order by 2 desc limit 8
       ) x) as top_pages,

      (select coalesce(json_agg(x), '[]'::json) from (
         select e.type,
                to_char(e.created_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') as at,
                e.path, e.city, e.device, e.value,
                p.name as "productName"
           from recent e
           left join products p on p.id = e.product_id
          order by e.created_at desc limit 30
       ) x) as feed
  `)

  const r = [...rows][0]

  return {
    activeNow: Number(r?.active_now ?? 0),
    sessionsHour: Number(r?.sessions_hour ?? 0),
    activeCarts: Number(r?.active_carts ?? 0),
    checkoutsHour: Number(r?.checkouts_hour ?? 0),
    ordersHour: Number(r?.orders_hour ?? 0),
    revenueHour: Number(r?.revenue_hour ?? 0),
    byDevice: r?.by_device ?? [],
    byCity: r?.by_city ?? [],
    bySource: r?.by_source ?? [],
    topPages: r?.top_pages ?? [],
    feed: r?.feed ?? [],
  }
}
