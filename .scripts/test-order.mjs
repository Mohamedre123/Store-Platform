/** طلب تجربة في متجر التحقق — عشان أشوف كارت المندوب وهو مليان */
import { config as loadEnv } from 'dotenv'
import postgres from 'postgres'
loadEnv({ path: '.env.local', quiet: true })

const SLUG = 'zwverifytmp'
const client = postgres(process.env.DIRECT_URL, { max: 1, prepare: false })

try {
  const [s] = await client`select id from stores where slug = ${SLUG}`
  if (!s) throw new Error('no verify store')

  const [o] = await client`
    insert into orders (
      store_id, order_number, status, payment_status, customer_name, customer_phone,
      shipping_address, subtotal, shipping_total, total, currency, payment_method, notes
    ) values (
      ${s.id}, 1001, 'confirmed', 'unpaid', 'سارة أحمد', '+201112223334',
      ${client.json({ city: 'القاهرة', area: 'مدينة نصر', street: '١٢ شارع مصطفى النحاس', building: 'عمارة ٥' })},
      45000, 5000, 50000, 'EGP', 'cod', 'الدور التالت، الشقة على الشمال'
    ) returning id
  `

  await client`
    insert into order_items (order_id, store_id, name, price, quantity, total)
    values (${o.id}, ${s.id}, 'تيشيرت قطن أبيض', 45000, 1, 45000)
  `

  console.log(JSON.stringify({ storeId: s.id, orderId: o.id }, null, 2))
} finally {
  await client.end()
}
