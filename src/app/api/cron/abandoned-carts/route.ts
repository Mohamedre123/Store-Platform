import { NextResponse, type NextRequest } from 'next/server'
import { sendAbandonedCartReminders } from '@/lib/abandoned-carts'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * مهمة مجدولة: تذكير السلات المتروكة.
 *
 * Vercel Cron بينادي المسار ده بترويسة authorization فيها CRON_SECRET.
 * من غير التحقّق ده أي حد يقدر يشغّل الإرسال ويستهلك حصّة البريد —
 * أو يزعج عملاء التجّار برسايل متكررة.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET

  if (secret) {
    const auth = req.headers.get('authorization')
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'غير مصرّح' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    // في الإنتاج من غير سر، الأأمن نرفض بدل ما نسيب المسار مفتوح
    return NextResponse.json({ error: 'CRON_SECRET غير مضبوط' }, { status: 503 })
  }

  const result = await sendAbandonedCartReminders()
  return NextResponse.json({ ok: true, ...result })
}
