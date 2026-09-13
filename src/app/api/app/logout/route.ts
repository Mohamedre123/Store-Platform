import type { NextRequest } from 'next/server'
import { json, sameOrigin } from '@/lib/app-api'
import { destroySession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/logout — تسجيل الخروج من قايمة «المزيد» في التطبيق.
 *
 * نفس اللي `logoutAction` بيعمله (بيمسح الجلسة من القاعدة والكوكي)،
 * بس بيرد JSON بدل التحويل — التطبيق بيفضّي بياناته المحفوظة على
 * الجهاز وبعدين بيفتح صفحة الدخول بنفسه.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  await destroySession()
  return json({ ok: true })
}
