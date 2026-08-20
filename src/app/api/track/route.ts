import { NextResponse, type NextRequest } from 'next/server'
import { getStore } from '@/lib/storefront'
import { isTrackable, recordEvent } from '@/lib/analytics-events'

export const dynamic = 'force-dynamic'

/**
 * استقبال أحداث المتجر.
 *
 * مفتوح من غير مصادقة — لازم يكون كده، الزائر مش مسجّل دخول. عشان
 * كده كل حاجة جاية من المتصفح بتتعامل كمُدخل غير موثوق:
 *
 * - نوع الحدث من قائمة مغلقة، وأي حاجة تانية بتترفض.
 * - المتجر بيتحدّد من المعرّف اللي في الطلب وبيتأكد إنه موجود، فمحدش
 *   يقدر يحقن أحداثًا على متجر مش بتاعه بمعرّف عشوائي.
 * - مفيش قيم مالية جاية من المتصفح خالص: الإيراد بيتحسب من الطلبات
 *   المسجّلة، والحدث بيقيس السلوك بس.
 *
 * الرد 204 من غير جسم: المتصفح مش محتاج يعرف حاجة، والفشل هنا ما
 * يصحّش يعطّل تصفّح العميل.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      store?: string
      type?: string
      sessionId?: string
      productId?: string
      path?: string
      referrer?: string
    }

    if (!body.store || !body.type || !body.sessionId) {
      return new NextResponse(null, { status: 204 })
    }
    if (!isTrackable(body.type)) return new NextResponse(null, { status: 204 })

    const store = await getStore(body.store)
    if (!store) return new NextResponse(null, { status: 204 })

    // الجهاز من ترويسة المتصفح لا من المتصفح نفسه — أصدق وأصعب في التزوير
    const ua = req.headers.get('user-agent') ?? ''
    const device: 'mobile' | 'tablet' | 'desktop' = /iPad|Tablet/i.test(ua)
      ? 'tablet'
      : /Mobi|Android|iPhone/i.test(ua)
        ? 'mobile'
        : 'desktop'

    await recordEvent({
      storeId: store.id,
      type: body.type,
      sessionId: body.sessionId,
      productId: body.productId,
      path: body.path,
      referrer: body.referrer,
      device,
    })
  } catch {
    // جسم تالف أو قاعدة بيانات مشغولة — الحدث بيضيع والتصفّح بيكمّل
  }

  return new NextResponse(null, { status: 204 })
}
