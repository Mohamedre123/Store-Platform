import 'server-only'
import { NextResponse, type NextRequest } from 'next/server'
import { getOptionalDashboardContext, type DashboardContext } from '@/lib/store-context'
import { can, type Permission } from '@/lib/permissions'

/**
 * أدوات مسارات تطبيق الموبايل (`/api/app/*`).
 *
 * كل المسارات دي بجلسة اللوحة نفسها وبنفس صلاحياتها، وبترد JSON دايمًا
 * — حتى الرفض — عشان التطبيق يعرف يفرّق بين «الجلسة خلصت» و«مالكش
 * صلاحية» و«النت واقع».
 */

/*
  بيانات تاجر — ما يصحّش تتخزّن في أي كاش وسيط، ولا ترجع لجلسة تانية
  من كاش المتصفح بعد تسجيل الخروج.
*/
export const NO_STORE = { 'Cache-Control': 'private, no-store' } as const

export function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: NO_STORE })
}

/**
 * سياق اللوحة أو رد الرفض الجاهز.
 *
 * الصلاحية نفس اللي صفحة اللوحة بتطلبها بـ`guard()` — الموظف اللي
 * ما بيشوفش الطلبات على اللابتوب ما يشوفهاش من الموبايل.
 */
export async function appContext(permission?: Permission): Promise<DashboardContext | NextResponse> {
  const ctx = await getOptionalDashboardContext()
  if (!ctx) return json({ error: 'unauthorized' }, 401)
  if (permission && !can(ctx.actor, permission)) return json({ error: 'forbidden' }, 403)
  return ctx
}

/**
 * طلبات الكتابة من نفس الأصل بس.
 *
 * أفعال الخادم في Next بتتحقق من الأصل لوحدها، والمسارات دي لأ. من
 * غير الشرط ده، صفحة على موقع تاني كانت تقدر تبعت «غيّر حالة الطلب»
 * بجلسة التاجر وهو فاتحها في نفس المتصفح.
 */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get('origin')
  if (!origin) return false
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host')
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** معرّف من الرابط — شكل معقول قبل ما يوصل للقاعدة */
export function isRecordId(id: string): boolean {
  return /^[\w-]{6,64}$/.test(id)
}
