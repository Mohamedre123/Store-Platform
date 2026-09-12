import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { orderDetailPayload } from '@/lib/app-orders'
import { ORDER_STATUSES } from '@/lib/order-status'
import { updateOrderStatusAction } from '@/app/dashboard/orders/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/orders/:id/status — تغيير حالة الطلب من التطبيق.
 *
 * بينادي فعل اللوحة نفسه (`updateOrderStatusAction`) مش نسخة منه:
 * المخزون، الإشعار على القناة المختارة، سجل الطلب، والشحن التلقائي —
 * كله بيحصل بالظبط زي ضغطة الزرار في اللوحة.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  const body = (await req.json().catch(() => null)) as { status?: unknown; channel?: unknown } | null
  const status = ORDER_STATUSES.find((s) => s.key !== 'incomplete' && s.key === body?.status)?.key
  if (!status) return json({ ok: false, error: 'حالة غير معروفة' }, 400)

  try {
    await updateOrderStatusAction(id, status, body?.channel)
  } catch (err) {
    return json({ ok: false, error: err instanceof Error ? err.message : 'ما قدرناش نغيّر الحالة' }, 500)
  }

  const detail = await orderDetailPayload(ctx.store, id)
  if (!detail) return json({ ok: false, error: 'not_found' }, 404)
  return json({ ok: true, detail })
}
