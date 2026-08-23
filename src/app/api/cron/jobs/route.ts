import { NextResponse, type NextRequest } from 'next/server'
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
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET

  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'CRON_SECRET غير مضبوط' }, { status: 503 })
  }

  const summary = await drainJobs(40)
  const pruned = await pruneJobs().catch(() => 0)

  return NextResponse.json({ ok: true, ...summary, pruned })
}
