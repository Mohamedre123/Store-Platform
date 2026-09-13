import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { assignCourierAction } from '@/app/dashboard/couriers/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/couriers/assign — `{ orderId, courierId }` إسناد طلب لمندوب */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as { orderId?: unknown; courierId?: unknown }
  const orderId = typeof body.orderId === 'string' ? body.orderId : ''
  const courierId = typeof body.courierId === 'string' ? body.courierId : ''
  if (!isRecordId(orderId) || !isRecordId(courierId)) return json({ ok: false, error: 'اختار الطلب والمندوب' }, 400)

  const res = await assignCourierAction(orderId, courierId)
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
