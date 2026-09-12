import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { productDetailPayload } from '@/lib/app-products'
import { toggleProductStatusAction } from '@/app/dashboard/products/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/products/:id/status — نشر المنتج أو إرجاعه مسوّدة.
 *
 * بينادي فعل اللوحة نفسه. الصلاحية `products.manage` هنا لأن الفعل
 * نفسه ما بيتحققش منها — والموظف اللي بيشوف المنتجات بس ما يصحّش
 * يخفي منتج من المتجر.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)
  if (!(await productDetailPayload(ctx.store, id))) return json({ ok: false, error: 'not_found' }, 404)

  await toggleProductStatusAction(id)
  return json({ ok: true, detail: await productDetailPayload(ctx.store, id) })
}
