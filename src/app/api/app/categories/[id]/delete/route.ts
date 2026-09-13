import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { deleteCategoryAction } from '@/app/dashboard/products/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/categories/:id/delete — المنتجات اللي في القسم بتفضل، من غير قسم */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)
  await deleteCategoryAction(id)
  return json({ ok: true })
}
