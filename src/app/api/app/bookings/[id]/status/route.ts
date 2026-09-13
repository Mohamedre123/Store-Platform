import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { setBookingStatusAction } from '@/app/dashboard/bookings/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/bookings/:id/status — `{ status }` نفس أزرار حالة الحجز */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)
  const body = (await req.json().catch(() => ({}))) as { status?: unknown }

  const res = await setBookingStatusAction(id, typeof body.status === 'string' ? body.status : '')
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
