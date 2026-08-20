import { NextResponse, type NextRequest } from 'next/server'
import { resolveHost } from '@/lib/domain'

export const config = {
  matcher: [
    /*
     * كل المسارات ما عدا:
     * - ملفات Next الداخلية
     * - الملفات الثابتة (لها امتداد)
     * - مسارات الـAPI العامة التي تحدّد متجرها بنفسها
     */
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\..*).*)',
  ],
}

export default function proxy(req: NextRequest) {
  const host = req.headers.get('host')
  const target = resolveHost(host)
  const url = req.nextUrl.clone()
  const path = url.pathname

  const headers = new Headers(req.headers)
  headers.set('x-zawya-host', host ?? '')
  headers.set('x-zawya-path', path)

  // وضع المعاينة: الإطار في محرّر الثيم بيحمّل المتجر بـ?preview=1.
  // الترويسة دي بتوصل للـ layout والصفحات (اللي مبتاخدش searchParams)
  // فتقرأ المسوّدة غير المنشورة بدل النسخة الحيّة.
  if (url.searchParams.get('preview') === '1') headers.set('x-zawya-preview', '1')

  /**
   * كود المسوّق من الرابط (‎?ref=CODE‎).
   *
   * بيتخزّن في كوكي هنا عشان يفضل مع العميل لو تصفّح صفحات تانية قبل ما
   * يشتري. الكتابة في الوكيل مش في الصفحة: الصفحات مكوّنات خادم وما
   * تقدرش تكتب كوكيز أثناء العرض.
   */
  const ref = url.searchParams.get('ref')?.trim().slice(0, 24)

  /*
    كود إحالة العملاء (‎?rf=CODE‎) — منفصل عن ‎?ref=‎ بتاع المسوّقين
    بالعمولة عن قصد. لو الاتنين على نفس المفتاح، زيارة من رابط صاحب
    كانت هتمسح تتبّع المسوّق (أو العكس) وحد فيهم يضيع مستحقّه.
  */
  const rf = url.searchParams.get('rf')?.trim().slice(0, 24)

  /** يلحق كوكي المسوّق بأي استجابة قبل ما ترجع */
  const finish = (res: NextResponse) => {
    if (ref) {
      res.cookies.set('zw_ref', ref, {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
        httpOnly: false,
      })
    }
    if (rf) {
      res.cookies.set('zw_rf', rf, {
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
        sameSite: 'lax',
        httpOnly: false,
      })
    }
    return res
  }

  /**
   * مسار المتجر الصريح يُخدَم كما هو من أي مضيف.
   *
   * لازم عشان معاينة المحرّر: لوحة التاجر على نطاق، ومتجره على نطاق
   * تاني. لو الإطار حمّل نطاق المتجر كان هيبقى أصلًا مختلفًا، والمعاينة
   * تفشل لو النطاق الفرعي لسه ما اشتغلش. بالمسار ده الإطار بيفضل على
   * نفس أصل اللوحة، فالمعاينة تشتغل مهما كان إعداد النطاقات.
   */
  if (path.startsWith('/s/')) {
    return finish(NextResponse.next({ request: { headers } }))
  }

  if (target.kind === 'dashboard') {
    // dashboard.zawya.app/orders  →  /dashboard/orders
    if (!path.startsWith('/dashboard') && !path.startsWith('/api')) {
      url.pathname = `/dashboard${path === '/' ? '' : path}`
      return finish(NextResponse.rewrite(url, { request: { headers } }))
    }
    return finish(NextResponse.next({ request: { headers } }))
  }

  if (target.kind === 'store') {
    headers.set('x-zawya-store', target.identifier)
    if (path.startsWith('/api')) {
      return finish(NextResponse.next({ request: { headers } }))
    }
    // matgar.zawya.app/products  →  /s/matgar/products
    url.pathname = `/s/${target.identifier}${path === '/' ? '' : path}`
    return finish(NextResponse.rewrite(url, { request: { headers } }))
  }

  // الموقع التعريفي — لا إعادة كتابة
  return finish(NextResponse.next({ request: { headers } }))
}
