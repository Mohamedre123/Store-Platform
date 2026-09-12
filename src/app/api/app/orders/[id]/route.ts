import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json } from '@/lib/app-api'
import { orderDetailPayload } from '@/lib/app-orders'

export const dynamic = 'force-dynamic'

/** GET /api/app/orders/:id — تفاصيل الطلب في تطبيق الموبايل */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ error: 'not_found' }, 404)

  const detail = await orderDetailPayload(ctx.store, id)
  if (!detail) return json({ error: 'not_found' }, 404)
  return json(detail)
}
