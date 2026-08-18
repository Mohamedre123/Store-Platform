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
   * مسار المتجر الصريح يُخدَم كما هو من أي مضيف.
   *
   * لازم عشان معاينة المحرّر: لوحة التاجر على نطاق، ومتجره على نطاق
   * تاني. لو الإطار حمّل نطاق المتجر كان هيبقى أصلًا مختلفًا، والمعاينة
   * تفشل لو النطاق الفرعي لسه ما اشتغلش. بالمسار ده الإطار بيفضل على
   * نفس أصل اللوحة، فالمعاينة تشتغل مهما كان إعداد النطاقات.
   */
  if (path.startsWith('/s/')) {
    return NextResponse.next({ request: { headers } })
  }

  if (target.kind === 'dashboard') {
    // dashboard.zawya.app/orders  →  /dashboard/orders
    if (!path.startsWith('/dashboard') && !path.startsWith('/api')) {
      url.pathname = `/dashboard${path === '/' ? '' : path}`
      return NextResponse.rewrite(url, { request: { headers } })
    }
    return NextResponse.next({ request: { headers } })
  }

  if (target.kind === 'store') {
    headers.set('x-zawya-store', target.identifier)
    if (path.startsWith('/api')) {
      return NextResponse.next({ request: { headers } })
    }
    // matgar.zawya.app/products  →  /s/matgar/products
    url.pathname = `/s/${target.identifier}${path === '/' ? '' : path}`
    return NextResponse.rewrite(url, { request: { headers } })
  }

  // الموقع التعريفي — لا إعادة كتابة
  return NextResponse.next({ request: { headers } })
}
