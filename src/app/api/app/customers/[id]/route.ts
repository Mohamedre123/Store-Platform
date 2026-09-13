import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json } from '@/lib/app-api'
import { customerDetailPayload } from '@/lib/app-customers'

export const dynamic = 'force-dynamic'

/** GET /api/app/customers/:id — تفاصيل العميل وطلباته في تطبيق الموبايل */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await appContext('customers.view')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ error: 'not_found' }, 404)

  const detail = await customerDetailPayload(ctx.store, id)
  if (!detail) return json({ error: 'not_found' }, 404)
  return json(detail)
}
