import { config as loadEnv } from 'dotenv'
import postgres from 'postgres'
loadEnv({ path: '.env.local', quiet: true })
const client = postgres(process.env.DIRECT_URL, { max: 1, prepare: false })
try {
  const stores = await client`select id, name from stores limit 3`
  console.log('stores:', stores.map(s => s.name).join(', ') || '(none)')
  const storeId = stores[0]?.id
  if (!storeId) { console.log('no store to test with'); process.exit(0) }

  const r = await client.unsafe(`
    with recent as (
      select * from store_events
      where store_id = $1 and created_at >= now() - interval '2 hours'
    ),
    live as (select * from recent where created_at >= now() - interval '5 minutes'),
    hour as (select * from recent where created_at >= now() - interval '1 hour')
    select
      (select count(distinct session_id)::int from live) as active_now,
      (select count(distinct session_id)::int from hour) as sessions_hour,
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
         select coalesce(device, 'unknown') as key, count(distinct session_id)::int as n
           from hour group by 1 order by 2 desc limit 4
       ) x) as by_device,
      (select coalesce(json_agg(x), '[]'::json) from (
         select coalesce(nullif(city, ''), 'unknown') as key, count(distinct session_id)::int as n
           from hour group by 1 order by 2 desc limit 8
       ) x) as by_city,
      (select coalesce(json_agg(x), '[]'::json) from (
         select coalesce(nullif(utm->>'source', ''), 'direct') as key,
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
  `, [storeId])
  console.log(JSON.stringify(r[0], null, 2))
} finally { await client.end() }
