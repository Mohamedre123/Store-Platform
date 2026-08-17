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
    /**
     * اتصال واحد لكل نسخة — وده مقصود مش تقليل.
     *
     * على Vercel كل نسخة بتخدم طلبًا واحدًا في اللحظة، فاتصال واحد
     * كفاية. لما كانت 10، كل نسخة كانت بتفتح 10 اتصالات، وVercel
     * بيشغّل عشرات النسخ وقت الضغط — فتتخطّى حدود Supabase وترفض
     * الاتصالات الجديدة، والنتيجة إن الموقع «بيقع» فجأة ويرجع.
     */
    max: 1,
    // إطلاق الاتصال بسرعة عشان ما يفضلش محجوزًا بعد انتهاء الطلب
    idle_timeout: 10,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
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
