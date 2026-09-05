/**
 * حساب تجربة مؤقّت — للتحقّق من الشاشات بالعين قبل الرفع.
 *
 * `create` بيعمله، و`drop` بيمسحه هو ومتجره. الاتنين idempotent.
 *
 * السبب: البناء اللي بيعدّي مش دليل إن الصفحة بترسم. صفحة اتبعت
 * فيها أيقونة من مكوّن خادم لمكوّن عميل بتعدّي `tsc` و`next build`
 * الاتنين وبترمي وقت التصيير بس.
 */
import { config as loadEnv } from 'dotenv'
import postgres from 'postgres'
import bcrypt from 'bcryptjs'

loadEnv({ path: '.env.local', quiet: true })

const EMAIL = 'zw-verify-temp@example.test'
const PASS = 'Verify!2026#tmp'
const SLUG = 'zwverifytmp'

const client = postgres(process.env.DIRECT_URL, { max: 1, prepare: false })
const cmd = process.argv[2]

try {
  if (cmd === 'create') {
    const hash = await bcrypt.hash(PASS, 12)

    const [u] = await client`
      insert into users (email, name, password_hash, email_verified_at)
      values (${EMAIL}, 'حساب تحقق مؤقت', ${hash}, now())
      on conflict (email) do update
        set password_hash = ${hash}, email_verified_at = now()
      returning id
    `

    await client`
      insert into stores (slug, name, currency, is_published, status, trial_ends_at)
      values (${SLUG}, 'متجر التحقق', 'EGP', true, 'trial', now() + interval '3 days')
      on conflict do nothing
    `
    const [s] = await client`select id from stores where slug = ${SLUG}`

    await client`
      insert into store_members (store_id, user_id, role, permissions, accepted_at)
      values (${s.id}, ${u.id}, 'owner', '[]'::jsonb, now())
      on conflict do nothing
    `

    console.log(JSON.stringify({ email: EMAIL, password: PASS, storeId: s.id, userId: u.id }, null, 2))
  } else if (cmd === 'drop') {
    await client`delete from stores where slug = ${SLUG}`
    const r = await client`delete from users where email = ${EMAIL} returning id`
    console.log(r.length ? 'deleted' : 'nothing to delete')
  } else {
    console.log('usage: node .scripts/test-account.mjs create | drop')
  }
} finally {
  await client.end()
}
