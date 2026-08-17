import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const connectionString = process.env.DATABASE_URL

if (!connectionString && process.env.NODE_ENV === 'production') {
  throw new Error('DATABASE_URL غير مضبوط — راجع .env.example')
}

/**
 * في التطوير نعيد استخدام نفس الاتصال عبر عمليات إعادة التحميل الساخن،
 * وإلا تتراكم الاتصالات حتى ترفض Supabase الاتصالات الجديدة.
 */
const globalForDb = globalThis as unknown as { __zawyaClient?: ReturnType<typeof postgres> }

const client =
  globalForDb.__zawyaClient ??
  postgres(connectionString ?? '', {
    max: process.env.NODE_ENV === 'production' ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false, // مطلوب مع Supabase transaction pooler
  })

if (process.env.NODE_ENV !== 'production') globalForDb.__zawyaClient = client

export const db = drizzle(client, { schema })
export { schema }
export type Database = typeof db
