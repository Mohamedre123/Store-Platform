import { NextResponse, type NextRequest } from 'next/server'
import { sendAbandonedCartReminders } from '@/lib/abandoned-carts'
import { rollupAllStores } from '@/lib/analytics-events'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * المهمة المجدولة اليومية: تذكير السلات المتروكة + تجميع الإحصاءات.
 *
 * الاتنين في مسار واحد عن قصد: خطة Vercel المجانية بتسمح بمهمة يومية،
 * ومهمتين منفصلتين كانوا هيرفضوا النشر كله (وده اللي حصل فعلًا قبل
 * كده). لو الخطة اتوسّعت، الفصل بيبقى نقل سطر.
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

  /*
    بنجمّع إمبارح لا النهاردة: اليوم لسه ما خلصش، والصف بتاعه هيبقى
    ناقص ويفضل ناقص لأن المهمة مش هتتنادى تاني قبل بكرة.
  */
  const yesterday = new Date(Date.now() - 86_400_000)
  let rolledUp = 0
  try {
    rolledUp = await rollupAllStores(yesterday)
  } catch (e) {
    // فشل التجميع ما يصحّش يخلّي المهمة كلها تبان فاشلة — التذكيرات
    // اتبعتت فعلًا، وإعادة المحاولة بكرة بتصلّح الصف
    console.error('فشل تجميع الإحصاءات:', e)
  }

  return NextResponse.json({ ok: true, ...result, rolledUp })
}
