import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { setStockAction } from '@/app/dashboard/inventory/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/inventory/stock — تعديل كمية منتج أو متغيّر.
 *
 * بينادي فعل اللوحة نفسه، فالحركة بتتسجّل في «سجل الحركة» زي أي تعديل يدوي.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('inventory.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => null)) as { kind?: unknown; id?: unknown; stock?: unknown } | null
  const kind = body?.kind === 'variant' ? 'variant' : body?.kind === 'product' ? 'product' : null
  const id = typeof body?.id === 'string' ? body.id : ''
  const stock = typeof body?.stock === 'number' ? body.stock : Number.NaN
  if (!kind || !isRecordId(id) || !Number.isFinite(stock)) {
    return json({ ok: false, error: 'اكتب كمية صحيحة' }, 400)
  }

  const res = (await setStockAction({ kind, id, stock, note: 'من تطبيق الموبايل' })) as {
    ok?: boolean
    stock?: number
    error?: string
  }
  if (res.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true, stock: res.stock ?? stock })
}
