import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { productDetailPayload } from '@/lib/app-products'
import { deleteProductAction } from '@/app/dashboard/products/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/products/:id/delete — نقل المنتج لسلة المهملات.
 *
 * فعل اللوحة نفسه: حذف ناعم، والصور بتفضل، ويترجع من السلة بضغطة.
 * الصلاحية `products.manage` هنا لأن الفعل نفسه ما بيتحققش منها.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('products.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)
  if (!(await productDetailPayload(ctx.store, id))) return json({ ok: false, error: 'not_found' }, 404)

  await deleteProductAction(id)
  return json({ ok: true })
}
