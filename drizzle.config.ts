import { config as loadEnv } from 'dotenv'
import type { Config } from 'drizzle-kit'

// الأولوية للملف المحلي، ثم .env العادي
loadEnv({ path: '.env.local', quiet: true })
loadEnv({ quiet: true })

/**
 * الهجرات تمرّ عبر Session pooler (منفذ 5432) وليس Transaction pooler،
 * لأن أوامر تعديل المخطط تحتاج جلسة ثابتة.
 */
export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL || process.env.DATABASE_URL || '',
  },
  verbose: true,
  strict: true,
} satisfies Config
