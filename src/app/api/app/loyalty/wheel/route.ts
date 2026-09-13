import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { wheelPrizes, wheelSettings } from '@/db/schema'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { wheelPrizeInputs } from '@/lib/loyalty-data'
import { saveWheelAction } from '@/app/dashboard/loyalty/wheel-actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/loyalty/wheel — `{ enabled }` تشغيل عجلة الحظ أو إيقافها.
 *
 * `saveWheelAction` بيكتب الإعدادات والجوايز من الأول، فبنبعت العنوان والجوايز
 * الموجودين زي ما هم. تعديل الجوايز نفسها من صفحة المنصة.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('customers.view')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as { enabled?: unknown }
  const [[w], prizes] = await Promise.all([
    db.select().from(wheelSettings).where(eq(wheelSettings.storeId, ctx.store.id)).limit(1),
    db.select().from(wheelPrizes).where(eq(wheelPrizes.storeId, ctx.store.id)).orderBy(wheelPrizes.position),
  ])

  const res = await saveWheelAction({
    enabled: body.enabled === true,
    title: w?.title ?? 'جرّب حظك',
    subtitle: w?.subtitle ?? '',
    triggerAfterSeconds: String(w?.triggerAfterSeconds ?? 15),
    freeSpinsPerDay: String(w?.freeSpinsPerDay ?? 1),
    prizes: wheelPrizeInputs(prizes),
  })
  if (res?.error) {
    const hint = prizes.length < 2 ? ' — ضيف الجوايز من «عدّل العجلة» الأول' : ''
    return json({ ok: false, error: `${res.error}${hint}` }, 400)
  }
  return json({ ok: true })
}
