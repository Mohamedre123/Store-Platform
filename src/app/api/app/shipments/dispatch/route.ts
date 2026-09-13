import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { dispatchShipmentAction } from '@/app/dashboard/shipments/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/shipments/dispatch — `{ orderId }` تسجيل الشحنة عند شركة الشحن المربوطة بضغطة */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as { orderId?: unknown }
  const orderId = typeof body.orderId === 'string' ? body.orderId : ''
  if (!isRecordId(orderId)) return json({ ok: false, error: 'الطلب مش موجود' }, 400)

  const res = await dispatchShipmentAction(orderId)
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
