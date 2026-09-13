import { NextResponse, type NextRequest } from 'next/server'
import { and, eq, ne } from 'drizzle-orm'
import { db } from '@/db'
import { pushDevices } from '@/db/schema'
import { appContext, json, sameOrigin } from '@/lib/app-api'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/push/register — التطبيق بيسجّل جهازه لإشعارات المتجر النشط.
 *
 * بيتنادى مرة كل تشغيل. الجهاز اللي اتسجّل عليه حساب تاني قبل كده
 * بيتشال من الحساب القديم — الموبايل اللي اتباع ما يفضلش يستقبل طلبات
 * صاحبه الأولاني.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext()
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => null)) as { token?: unknown; platform?: unknown } | null
  const token = typeof body?.token === 'string' ? body.token.trim() : ''
  const platform = body?.platform === 'ios' ? 'ios' : body?.platform === 'android' ? 'android' : null
  if (token.length < 20 || token.length > 4096 || !platform) return json({ ok: false, error: 'invalid' }, 400)

  await db.delete(pushDevices).where(and(eq(pushDevices.token, token), ne(pushDevices.userId, ctx.user.id)))
  await db
    .insert(pushDevices)
    .values({ userId: ctx.user.id, storeId: ctx.store.id, token, platform })
    .onConflictDoUpdate({
      target: [pushDevices.token, pushDevices.storeId],
      set: { userId: ctx.user.id, platform, lastSeenAt: new Date() },
    })

  return json({ ok: true })
}
