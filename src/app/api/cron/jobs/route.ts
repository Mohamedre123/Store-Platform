import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { platformSettings } from '@/db/schema'
import { drainJobs, pruneJobs } from '@/lib/jobs'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * عامل طابور المهام.
 *
 * بيسحب اللي حان وقته وينفّذه. بيتنادى من Vercel Cron، وكمان بيقدر
 * يتنادى يدويًا من صفحة المطوّرين لما التاجر يستعجل مهمة واقفة.
 *
 * **التحقّق من السرّ إلزامي في الإنتاج.** المسار ده بيبعت رسايل
 * ويسجّل شحنات — لو مفتوح، أي حد يقدر يستنزف حصّة البريد بتاعتنا
 * ويزعج عملاء التجّار.
 *
 * ورده بيقول بالظبط إيه اللي حصل (اتسحب كام، نجح كام، فشل كام) —
 * الرد الفاضي بيخلّي تشخيص «ليه التذكير ما اتبعتش» تخمينًا.
 */
/**
 * توكن المنبّه المتخزّن في قاعدة البيانات.
 *
 * ## ليه فيه توكن تاني غير `CRON_SECRET`
 * المنبّه الزمني بيعيش **جوّه قاعدة البيانات** (`pg_cron`)، لأن الجدولة
 * كل دقيقة مش متاحة على خطة الاستضافة. والمنبّه ده ما بيشوفش متغيّرات
 * بيئة الاستضافة — فما يقدرش يبعت `CRON_SECRET`.
 *
 * فبيقرا توكنه من نفس القاعدة اللي هو عايش فيها. والمسار بيقبل الاتنين،
 * فمنبّه الاستضافة ومنبّه القاعدة الاتنين يشتغلوا.
 */
async function dbToken(): Promise<string | null> {
  try {
    const [row] = await db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, 'jobs_cron_token'))
      .limit(1)
    return row?.value ?? null
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')

  const fromHost = Boolean(secret) && auth === `Bearer ${secret}`
  const token = await dbToken()
  const fromDb = Boolean(token) && auth === `Bearer ${token}`

  if (!fromHost && !fromDb) {
    /*
      مفيش سرّ ولا توكن أصلًا؟ ده إعداد ناقص لا محاولة دخول — بنقولها
      بوضوح بدل «غير مصرّح» اللي بيخلّي التشخيص تخمينًا.
    */
    if (!secret && !token && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'مفيش سرّ للعامل — لا CRON_SECRET ولا توكن في القاعدة' }, { status: 503 })
    }
    if (secret || token) {
      return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })
    }
  }

  const summary = await drainJobs(40)
  const pruned = await pruneJobs().catch(() => 0)

  return NextResponse.json({ ok: true, ...summary, pruned })
}
