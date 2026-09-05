/** عميل تجربة في متجر التحقق، وربطه بالطلب — عشان أفتح صفحة حسابه */
import { config as loadEnv } from 'dotenv'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'
loadEnv({ path: '.env.local', quiet: true })

const SLUG = 'zwverifytmp'
const EMAIL = 'sara@example.test'
const PASS = 'Sara!2026#tmp'

const client = postgres(process.env.DIRECT_URL, { max: 1, prepare: false })

try {
  const [s] = await client`select id from stores where slug = ${SLUG}`
  if (!s) throw new Error('no verify store')

  const hash = await bcrypt.hash(PASS, 12)
  const [c] = await client`
    insert into customers (store_id, name, phone, email, password_hash, email_verified_at)
    values (${s.id}, 'سارة أحمد', '+201112223334', ${EMAIL}, ${hash}, now())
    on conflict (store_id, phone) do update
      set password_hash = ${hash}, email = ${EMAIL}, email_verified_at = now()
    returning id
  `

  await client`update orders set customer_id = ${c.id} where store_id = ${s.id}`

  console.log(JSON.stringify({ email: EMAIL, password: PASS, customerId: c.id }, null, 2))
} finally {
  await client.end()
}
