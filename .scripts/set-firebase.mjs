/**
 * يحط مفتاح حساب خدمة Firebase في `platform_settings` مشفّرًا بـ`ENCRYPTION_KEY`.
 *
 *   node .scripts/set-firebase.mjs "H:/for claude/<ملف>.json"
 *
 * ما بيطبعش أي حاجة من المفتاح. نفس خوارزمية `src/lib/crypto.ts` بالحرف.
 */
import { config as loadEnv } from 'dotenv'
import postgres from 'postgres'
import fs from 'fs'
import { createCipheriv, createHash, randomBytes } from 'node:crypto'

loadEnv({ path: '.env.local', quiet: true })
loadEnv({ quiet: true })

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url) throw new Error('no DB url')
if (!process.env.ENCRYPTION_KEY) throw new Error('no ENCRYPTION_KEY')

const raw = fs.readFileSync(process.argv[2], 'utf8')
const parsed = JSON.parse(raw)
if (parsed.type !== 'service_account' || !parsed.project_id || !parsed.client_email || !parsed.private_key) {
  throw new Error('الملف مش حساب خدمة Firebase')
}

const key = createHash('sha256').update(process.env.ENCRYPTION_KEY).digest()
const iv = randomBytes(12)
const cipher = createCipheriv('aes-256-gcm', key, iv)
const data = Buffer.concat([cipher.update(JSON.stringify(parsed), 'utf8'), cipher.final()])
const value = [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.')

const client = postgres(url, { max: 1, prepare: false })
try {
  await client`
    INSERT INTO platform_settings (key, value, updated_at)
    VALUES ('firebase_service_account', ${value}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
  `
  console.log('saved for project', parsed.project_id)
} finally {
  await client.end()
}
