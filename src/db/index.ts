import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

/**
 * الاتصال كسول عمدًا.
 *
 * لو رمينا خطأ عند تحميل الملف، البناء نفسه بيفشل على أي بيئة
 * لسه متغيّراتها مش مضبوطة. الأصح إن البناء يعدّي، والخطأ يظهر
 * أول ما حد يحاول يقرأ من قاعدة البيانات فعلًا.
 */

type Client = ReturnType<typeof postgres>
type Db = ReturnType<typeof drizzle<typeof schema>>

const globalForDb = globalThis as unknown as { __zawyaClient?: Client; __zawyaDb?: Db }

function createClient(): Client {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL غير مضبوط. انسخ .env.example إلى .env.local واملأ بيانات Supabase.',
    )
  }
  return postgres(connectionString, {
    max: process.env.NODE_ENV === 'production' ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 15,
    // مطلوب مع Supabase transaction pooler — لا يدعم العبارات المُجهَّزة
    prepare: false,
  })
}

function getDb(): Db {
  if (!globalForDb.__zawyaDb) {
    const client = globalForDb.__zawyaClient ?? createClient()
    if (process.env.NODE_ENV !== 'production') globalForDb.__zawyaClient = client
    const instance = drizzle(client, { schema })
    if (process.env.NODE_ENV !== 'production') globalForDb.__zawyaDb = instance
    return instance
  }
  return globalForDb.__zawyaDb
}

/**
 * يُنشئ الاتصال عند أول استخدام حقيقي فقط.
 * الاستعمال عادي تمامًا: `db.select()...`
 */
export const db = new Proxy({} as Db, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver)
  },
})

export { schema }
export type Database = Db
