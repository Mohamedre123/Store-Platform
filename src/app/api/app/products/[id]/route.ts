import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json } from '@/lib/app-api'
import { productDetailPayload } from '@/lib/app-products'

export const dynamic = 'force-dynamic'

/** GET /api/app/products/:id — تفاصيل المنتج في تطبيق الموبايل */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await appContext('products.view')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ error: 'not_found' }, 404)

  const detail = await productDetailPayload(ctx.store, id)
  if (!detail) return json({ error: 'not_found' }, 404)
  return json(detail)
}
