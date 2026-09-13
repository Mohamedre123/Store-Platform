import type { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { platformSettings } from '@/db/schema'
import { json } from '@/lib/app-api'
import { safeEqual } from '@/lib/crypto'
import { pushStatus } from '@/lib/push'

export const dynamic = 'force-dynamic'

/**
 * GET /api/app/push/status — تشخيص إعداد Firebase على الخادم الحي.
 *
 * بـ`CRON_SECRET` أو توكن العامل اللي في القاعدة (`jobs_cron_token`) —
 * نفس اللي `/api/cron/jobs` بيقبله. ومن غير أي سر في الرد: موجود؟
 * الدخول على جوجل شغّال؟ رقم المشروع.
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization') ?? ''
  const secret = process.env.CRON_SECRET
  let allowed = Boolean(secret) && safeEqual(auth, `Bearer ${secret}`)
  if (!allowed) {
    const [row] = await db
      .select({ value: platformSettings.value })
      .from(platformSettings)
      .where(eq(platformSettings.key, 'jobs_cron_token'))
      .limit(1)
      .catch(() => [])
    allowed = Boolean(row?.value) && safeEqual(auth, `Bearer ${row!.value}`)
  }
  if (!allowed) return json({ error: 'unauthorized' }, 401)
  return json(await pushStatus())
}
