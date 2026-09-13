import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { settleCodAction, updateShipmentStatusAction } from '@/app/dashboard/shipments/actions'
import { SHIPMENT_STATUSES, type ShipmentStatus } from '@/lib/carriers'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/shipments/:id/{status|settle}
 *
 * - status: `{ status, note? }` — واحدة من `SHIPMENT_STATUSES` (التسليم والرجوع بيتنقلوا للطلب)
 * - settle: `{ collected }` — الفلوس اتحصّلت من شركة الشحن أو لأ
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)
  const body = (await req.json().catch(() => ({}))) as { status?: unknown; note?: unknown; collected?: unknown }

  let res: { error?: string } | null
  if (action === 'status') {
    const status = SHIPMENT_STATUSES.find((s) => s.key === body.status)?.key as ShipmentStatus | undefined
    if (!status) return json({ ok: false, error: 'اختار حالة صحيحة' }, 400)
    const note = typeof body.note === 'string' && body.note.trim() ? body.note.trim().slice(0, 300) : undefined
    res = await updateShipmentStatusAction(id, status, note)
  } else if (action === 'settle') {
    res = await settleCodAction(id, body.collected === true)
  } else return json({ ok: false, error: 'not_found' }, 404)

  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
