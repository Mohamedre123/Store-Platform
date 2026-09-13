import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveCourierAction } from '@/app/dashboard/couriers/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/couriers/save — إضافة مندوب أو تعديله.
 *
 * `{ id?, name, phone, vehicle, zones, fee, note }` — الأجرة `fee` بالجنيه
 * زي خانة فورم اللوحة، وبتتخزّن بالقرش.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const feeText = String(body.fee ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
  const fee = Math.round(Number(feeText || 0) * 100)

  const res = await saveCourierAction({
    id: typeof body.id === 'string' && body.id ? body.id : undefined,
    name: body.name,
    phone: body.phone,
    vehicle: body.vehicle,
    zones: Array.isArray(body.zones) ? body.zones.filter((z) => typeof z === 'string') : [],
    feePerOrder: Number.isFinite(fee) && fee >= 0 ? fee : 0,
    note: typeof body.note === 'string' ? body.note : null,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true, id: res?.id ?? null })
}
