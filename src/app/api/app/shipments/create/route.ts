import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { createShipmentAction } from '@/app/dashboard/shipments/actions'

export const dynamic = 'force-dynamic'

const latin = (v: unknown) =>
  String(v ?? '')
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')

/**
 * POST /api/app/shipments/create — تسجيل شحنة يدوي على طلب.
 *
 * `{ orderId, carrier, trackingNumber, shippingCost, codAmount }` — المبالغ بالجنيه زي
 * خانات اللوحة. الفعل بيحوّل الطلب لـ«اتشحن» والعميل بيوصله رقم البوليصة.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const orderId = typeof body.orderId === 'string' ? body.orderId : ''
  if (!isRecordId(orderId)) return json({ ok: false, error: 'الطلب مش موجود' }, 400)

  const res = await createShipmentAction({
    orderId,
    carrier: typeof body.carrier === 'string' ? body.carrier : '',
    trackingNumber: typeof body.trackingNumber === 'string' ? body.trackingNumber : '',
    shippingCost: latin(body.shippingCost) || 0,
    codAmount: latin(body.codAmount) || 0,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
