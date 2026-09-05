import { config as loadEnv } from 'dotenv'
import postgres from 'postgres'
loadEnv({ path: '.env.local', quiet: true })
const client = postgres(process.env.DIRECT_URL, { max: 1, prepare: false })
try {
  const c = await client`select store_id, count(*)::int n, max(created_at) last from store_events group by 1 order by 2 desc limit 5`
  console.log('events per store:', c)
  if (!c.length) { console.log('store_events is empty'); process.exit(0) }
  const storeId = c[0].store_id
  // same shape, but a 400-day window so real rows flow through every aggregate
  const r = await client.unsafe(`
    with recent as (
      select * from store_events where store_id = $1 and created_at >= now() - interval '400 days'
    ), hour as (select * from recent)
    select
      (select count(distinct session_id)::int from hour) as sessions,
      (select count(distinct a.session_id)::int from recent a
        where a.type = 'add_to_cart' and not exists (
          select 1 from recent b where b.session_id = a.session_id
            and b.type in ('begin_checkout','purchase') and b.created_at > a.created_at)) as active_carts,
      (select coalesce(json_agg(x),'[]'::json) from (
        select coalesce(device,'unknown') as key, count(distinct session_id)::int n from hour group by 1 order by 2 desc limit 4) x) as by_device,
      (select coalesce(json_agg(x),'[]'::json) from (
        select coalesce(nullif(utm->>'source',''),'direct') as key, count(distinct session_id)::int n from hour group by 1 order by 2 desc limit 6) x) as by_source,
      (select coalesce(json_agg(x),'[]'::json) from (
        select path, count(*)::int n from hour where path is not null and path <> '' group by 1 order by 2 desc limit 5) x) as top_pages,
      (select coalesce(json_agg(x),'[]'::json) from (
        select e.type, to_char(e.created_at at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS"Z"') as at,
               e.path, e.city, e.device, e.value, p.name as "productName"
          from recent e left join products p on p.id = e.product_id
         order by e.created_at desc limit 5) x) as feed
  `, [storeId])
  console.log(JSON.stringify(r[0], null, 2))
} finally { await client.end() }
