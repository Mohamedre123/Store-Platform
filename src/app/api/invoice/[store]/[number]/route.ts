import { NextResponse, type NextRequest } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orders } from '@/db/schema'
import { getStore } from '@/lib/storefront'
import { loadInvoice } from '@/lib/invoice'
import { renderInvoicePdf } from '@/lib/invoice-pdf'

export const dynamic = 'force-dynamic'

/**
 * ملف الفاتورة.
 *
 * ## ليه مسار مفتوح برمز بدل صفحة بتسجيل دخول
 * الملف ده بيتبعت **مرفقًا** في البريد وكـ**مستند** على الواتساب.
 * ومزوّد الواتساب بيجيب الملف بنفسه من الرابط — مالوش كوكي ولا
 * جلسة، فصفحة بتسجيل دخول معناها إنه بيجيب صفحة الدخول ويبعتها
 * للعميل على إنها فاتورته.
 *
 * ## الرمز هو الإذن
 * `recoveryToken` عشوائي ١٦ بايت لكل طلب، وبيتقارن مقارنة كاملة.
 * اللي معاه الرمز هو صاحب الطلب أو اللي هو بعتله الرابط — ومحتوى
 * الملف بيانات طلبه هو لا أكتر.
 *
 * صفحة الفاتورة اللي بيتصفّحها العميل بنفسه فاضلة على شرط الدخول
 * زي ما هي: هناك فيه متصفح وجلسة، فالحماية الأقوى ما بتكلّفش حاجة.
 */
export const maxDuration = 30

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ store: string; number: string }> },
) {
  const { store: identifier, number } = await params
  const token = req.nextUrl.searchParams.get('t') ?? ''

  const store = await getStore(identifier)
  if (!store) return new NextResponse('مش موجود', { status: 404 })

  const orderNumber = Number(number)
  if (!Number.isFinite(orderNumber)) return new NextResponse('مش موجود', { status: 404 })

  const [order] = await db
    .select({ id: orders.id, token: orders.recoveryToken })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.orderNumber, orderNumber)))
    .limit(1)

  if (!order || !order.token || !token || token !== order.token) {
    return new NextResponse('مش موجود', { status: 404 })
  }

  const data = await loadInvoice(store.id, order.id)
  if (!data) return new NextResponse('مش موجود', { status: 404 })

  try {
    const pdf = await renderInvoicePdf(data)

    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        /*
          `inline` مش `attachment`: العميل بيدوس الرابط من الواتساب
          على موبايله، والمفروض الفاتورة تتفتح قدامه على طول — قارئ
          الـPDF في المتصفح فيه زرار حفظ أصلًا.
        */
        'Content-Disposition': `inline; filename="invoice-${orderNumber}.pdf"`,
        'Cache-Control': 'private, max-age=300',
      },
    })
  } catch (e) {
    /*
      توليد الـPDF بيعتمد على جلب الخط العربي من شبكة جوجل. لو وقع،
      بنقول السبب بدل ما نطلّع ملفًا حروفه مكسّرة — الفاتورة الغلط
      أسوأ من غيابها، والعميل بيقدر يفتح صفحة الفاتورة بدالها.
    */
    console.error('فشل توليد الفاتورة:', e)
    return new NextResponse('مقدرناش نجهّز الفاتورة دلوقتي', { status: 503 })
  }
}
