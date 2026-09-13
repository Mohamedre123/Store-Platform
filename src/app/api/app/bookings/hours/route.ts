import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveBookingHoursAction } from '@/app/dashboard/bookings/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/bookings/hours — `{ enabled, days, from, to, slotMinutes }` نفس «مواعيد العمل» في اللوحة */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  const res = await saveBookingHoursAction(body)
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
