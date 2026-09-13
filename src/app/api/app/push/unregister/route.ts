import type { NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { pushDevices } from '@/db/schema'
import { json, sameOrigin } from '@/lib/app-api'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/push/unregister — قبل تسجيل الخروج من التطبيق.
 *
 * من غير جلسة عن قصد: بيتنادى لحظة الخروج، والتوكن نفسه هو الإثبات —
 * محدش يعرفه غير الجهاز.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  if (token.length < 20 || token.length > 4096) return json({ ok: false, error: 'invalid' }, 400)
  await db.delete(pushDevices).where(eq(pushDevices.token, token))
  return json({ ok: true })
}
