import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { orderDetailPayload } from '@/lib/app-orders'
import { requestConfirmationAction } from '@/app/dashboard/orders/confirm-actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/orders/:id/confirm — طلب تأكيد من العميل على واتساب (فعل اللوحة نفسه) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  const res = await requestConfirmationAction(id)
  if (res?.error) return json({ ok: false, error: res.error }, 400)

  const detail = await orderDetailPayload(ctx.store, id)
  if (!detail) return json({ ok: false, error: 'not_found' }, 404)
  return json({ ok: true, detail })
}
