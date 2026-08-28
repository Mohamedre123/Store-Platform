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
     * خمس اتصالات لكل نسخة — لا واحد ولا عشرة.
     *
     * ## ليه مش واحد
     * Vercel بيجمّد النسخة بين الطلبات. الاتصال اللي اتجمّد وهو في
     * نص استعلام بيفضل مفتوح على الخادم مستني عميلًا مش هيرد،
     * والسوكيت من ناحيتنا ميت. مع اتصال واحد، ده معناه إن **النسخة
     * كلها ماتت**: كل طلب بعده بيستنى الاتصال الوحيد اللي مش هيفضى
     * أبدًا، لحد ما Vercel يقتل الدالة بـ504. وده اللي حصل فعلًا.
     *
     * ## وليه مش عشرة
     * حدّ Supavisor ٢٠٠ عميل. خمسة لكل نسخة بتسيب مساحة لأربعين
     * نسخة متوازية — أكتر بكتير من أي ضغط متوقع دلوقتي.
     *
     * **الشرط إن العميل يتخزّن** (تحت في getDb). من غير التخزين كل
     * استعلام بيعمل تجميعة جديدة، وساعتها أي رقم هنا مالوش معنى.
     */
    max: 5,
    /*
      عمر قصير عن قصد.

      النسخة المجمّدة مش بتشغّل مؤقتاتها، فالاتصال بيتقفل أول ما
      تصحى. كل ما العمر قصر، كل ما فرصة إننا نكتب على سوكيت ميت
      قلّت — والتكلفة اتصال جديد كل شوية وهو رخيص على البوّابة.
    */
    idle_timeout: 5,
    max_lifetime: 60 * 2,
    connect_timeout: 10,
    // مطلوب مع Supabase transaction pooler — لا يدعم العبارات المُجهَّزة
    prepare: false,
  })
}

/**
 * العميل بيتخزّن **في كل البيئات** — الإنتاج قبل التطوير.
 *
 * ## الباج اللي كان هنا
 * التخزين كان مشروط بـ`NODE_ENV !== 'production'`، يعني في الإنتاج
 * ما بيتخزّنش خالص. و`db` تحت ده Proxy بينادي `getDb()` مع **كل**
 * قراءة خاصية — فكل `db.select` وكل `db.insert` وكل `db.transaction`
 * كان بيعمل `postgres()` جديد، يعني تجميعة اتصالات جديدة بالكامل،
 * ومحدّش بيقفلها.
 *
 * صفحة واحدة فيها عشرين استعلام كانت بتفتح عشرين اتصال بالبوّابة.
 * حدّ Supavisor ٢٠٠ عميل، فالحد كان بيتاكل في دقايق والقاعدة ترد
 * `EMAXCONN` — والنتيجة إن **الموقع كله** يقع: المتاجر واللوحة
 * والشيك أوت مع بعض. وبيرجع لوحده بعد ما `idle_timeout` يفضّيهم،
 * فالعطل كان بيبان «عشوائي» ومربوط بالنشر وهو مش كده.
 *
 * التخزين هنا بيخلّي كل نسخة تفتح اتصالًا واحدًا وتفضل عليه — وده
 * بالظبط اللي `max: 1` فوق مكتوب عشانه.
 */
function getDb(): Db {
  if (globalForDb.__zawyaDb) return globalForDb.__zawyaDb

  const client = globalForDb.__zawyaClient ?? createClient()
  globalForDb.__zawyaClient = client

  const instance = drizzle(client, { schema })
  globalForDb.__zawyaDb = instance
  return instance
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
