/** أحداث تجربة في متجر التحقق — عشان أشوف العرض المباشر وهو مليان */
import { config as loadEnv } from 'dotenv'
import postgres from 'postgres'
loadEnv({ path: '.env.local', quiet: true })

const SLUG = 'zwverifytmp'
const client = postgres(process.env.DIRECT_URL, { max: 1, prepare: false })

try {
  const [s] = await client`select id from stores where slug = ${SLUG}`
  if (!s) throw new Error('no verify store')

  const cities = ['القاهرة', 'الجيزة', 'الإسكندرية', null]
  const devices = ['mobile', 'mobile', 'mobile', 'desktop', 'tablet']
  const sources = ['facebook', 'facebook', 'instagram', 'google', null]
  const paths = ['/', '/products', '/products/تيشيرت-قطن-أبيض', '/cart', '/checkout']

  const rows = []
  for (let i = 0; i < 40; i++) {
    const session = `sess-${i % 12}`
    const minsAgo = Math.floor(Math.random() * 55)
    const city = cities[i % cities.length]
    const src = sources[i % sources.length]
    rows.push({
      store_id: s.id,
      type: i % 9 === 0 ? 'add_to_cart' : i % 13 === 0 ? 'begin_checkout' : 'page_view',
      session_id: session,
      path: paths[i % paths.length],
      device: devices[i % devices.length],
      city,
      country: city ? 'EG' : null,
      utm: src ? { source: src, medium: 'cpc' } : null,
      mins: minsAgo,
    })
  }

  for (const r of rows) {
    await client`
      insert into store_events (store_id, type, session_id, path, device, city, country, utm, created_at)
      values (
        ${r.store_id}, ${r.type}, ${r.session_id}, ${r.path}, ${r.device},
        ${r.city}, ${r.country}, ${r.utm ? client.json(r.utm) : null},
        now() - (${r.mins} || ' minutes')::interval
      )
    `
  }

  /* اتنين لسه دلوقتي — عشان «زوّار دلوقتي» ما يبقاش صفر */
  for (const sid of ['sess-live-a', 'sess-live-b']) {
    await client`
      insert into store_events (store_id, type, session_id, path, device, city, country, created_at)
      values (${s.id}, 'page_view', ${sid}, '/', 'mobile', 'القاهرة', 'EG', now())
    `
  }

  console.log(`inserted ${rows.length + 2} events`)
} finally {
  await client.end()
}
