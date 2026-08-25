import { NextResponse, type NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { customers } from '@/db/schema'
import { hashToken } from '@/lib/crypto'

export const dynamic = 'force-dynamic'

/**
 * إلغاء الاشتراك بضغطة واحدة.
 *
 * ## ليه ده مهم للتسليم مش للأدب بس
 * **جيميل بيشترط `List-Unsubscribe-Post` على المرسلين** — ومن غيره
 * الرسايل التسويقية بتاخد علامة سلبية. وكنا شايلين الترويسة عن قصد
 * لأننا كنا بنوعد بعنوان بيستقبل POST **وإحنا مالناش** — والوعد
 * اللي مش وراه تنفيذ بيتحسب عيبًا أكبر من غيابه.
 *
 * دلوقتي فيه تنفيذ حقيقي، فالوعد بقى صادق.
 *
 * ## POST للآلة وGET للإنسان
 * جيميل بيبعت `POST` من غير ما المستخدم يفتح حاجة. واللي بيدوس
 * الرابط بإيده بيوصل بـ`GET` ولازم يشوف صفحة تقوله إن الإلغاء تمّ.
 *
 * ## الرمز مش المعرّف
 * الرابط فيه هاش الرمز لا معرّف العميل: من غير كده أي حد يقدر يعدّ
 * المعرّفات ويلغي اشتراك عملاء متجر مش بتاعه.
 */
async function unsubscribe(token: string): Promise<boolean> {
  if (!token) return false

  const hashed = hashToken(token)

  const rows = await db
    .update(customers)
    .set({ acceptsMarketing: false })
    .where(and(eq(customers.unsubscribeToken, hashed)))
    .returning({ id: customers.id })

  return rows.length > 0
}

export async function POST(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? ''
  await unsubscribe(token)
  /* جيميل مش بيقرا الرد — المهم إنه ٢٠٠ */
  return new NextResponse(null, { status: 200 })
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('t') ?? ''
  const done = await unsubscribe(token)

  const message = done
    ? 'تم إلغاء اشتراكك. مش هتوصلك رسايل تسويقية تاني.'
    : 'الرابط ده مش صالح أو اتلغى الاشتراك قبل كده.'

  return new NextResponse(
    `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8">
     <meta name="viewport" content="width=device-width,initial-scale=1">
     <title>إلغاء الاشتراك</title></head>
     <body style="margin:0;display:grid;place-items:center;min-height:100vh;background:#f4f3f9;
                  font-family:'Segoe UI',Tahoma,Arial,sans-serif;color:#222540;">
       <p style="background:#fff;border-radius:16px;padding:32px 28px;font-size:16px;
                 box-shadow:0 1px 3px rgba(0,0,0,.08);">${message}</p>
     </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  )
}
