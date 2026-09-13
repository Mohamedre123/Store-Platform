import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { setProductSupplierAction } from '@/app/dashboard/suppliers/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/suppliers/link — `{ productId, supplierId }` ربط منتج بمورّد، و`supplierId: null` بيفكّ الربط */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('inventory.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as { productId?: unknown; supplierId?: unknown }
  const productId = typeof body.productId === 'string' ? body.productId : ''
  const supplierId = typeof body.supplierId === 'string' && body.supplierId ? body.supplierId : null
  if (!isRecordId(productId) || (supplierId && !isRecordId(supplierId))) {
    return json({ ok: false, error: 'اختار المنتج' }, 400)
  }

  const res = await setProductSupplierAction(productId, supplierId)
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
