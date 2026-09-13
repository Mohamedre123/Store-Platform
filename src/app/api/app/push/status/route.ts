import type { NextRequest } from 'next/server'
import { json } from '@/lib/app-api'
import { safeEqual } from '@/lib/crypto'
import { pushStatus } from '@/lib/push'

export const dynamic = 'force-dynamic'

/**
 * GET /api/app/push/status — تشخيص إعداد Firebase على الخادم الحي.
 *
 * بـ`CRON_SECRET` بس، ومن غير أي سر في الرد: موجود؟ الدخول على جوجل
 * شغّال؟ رقم المشروع.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization') ?? ''
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return json({ error: 'unauthorized' }, 401)
  return json(await pushStatus())
}
