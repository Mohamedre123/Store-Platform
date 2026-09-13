import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { purgeProductAction, restoreProductAction } from '@/app/dashboard/products/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/trash/:id/{restore|purge}
 *
 * - restore: بيرجع المنتج **مسوّدة** (زي اللوحة)
 * - purge: مسح نهائي — للي في السلة بس
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  if (action === 'restore') await restoreProductAction(id)
  else if (action === 'purge') await purgeProductAction(id)
  else return json({ ok: false, error: 'not_found' }, 404)

  return json({ ok: true })
}
