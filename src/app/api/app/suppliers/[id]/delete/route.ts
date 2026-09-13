import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { deleteSupplierAction } from '@/app/dashboard/suppliers/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/suppliers/:id/delete — المنتجات المربوطة بتتفكّ مش بتتحذف */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('inventory.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)
  const res = await deleteSupplierAction(id)
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
