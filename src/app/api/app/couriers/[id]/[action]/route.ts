import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { rotateCourierTokenAction, settleCourierAction, toggleCourierAction } from '@/app/dashboard/couriers/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/couriers/:id/{toggle|settle|rotate} — نفس أزرار كارت المندوب.
 *
 * - toggle: `{ active }` وقّفه / شغّله
 * - settle: اقفل حسابه (بيرجّع `count` عدد الشحنات اللي اتقفلت)
 * - rotate: رابط جديد — القديم بيموت فورًا
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  if (action === 'toggle') {
    const body = (await req.json().catch(() => ({}))) as { active?: unknown }
    const res = await toggleCourierAction(id, body.active === true)
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  }
  if (action === 'settle') {
    const res = await settleCourierAction(id)
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true, count: res?.count ?? 0 })
  }
  if (action === 'rotate') {
    const res = await rotateCourierTokenAction(id)
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  }
  return json({ ok: false, error: 'not_found' }, 404)
}
