import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { transferStockAction } from '@/app/dashboard/inventory/branch-actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/branches/transfer — `{ fromId, toId, productId, quantity }` نقل بين الفروع (الإجمالي ما بيتغيّرش) */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('inventory.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  try {
    const res = await transferStockAction(body)
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
