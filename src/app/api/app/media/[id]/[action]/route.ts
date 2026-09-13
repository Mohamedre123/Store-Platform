import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { deleteMediaAction, renameMediaAction } from '@/app/dashboard/media/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/media/:id/{rename|delete}
 *
 * - rename: `{ name }` — الاسم للتاجر بس، الرابط ما بيتغيّرش
 * - delete: بيترفض لو الصورة مستعملة في منتج (نفس اللوحة)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('storefront.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  let res: { error?: string } | null
  if (action === 'rename') {
    const body = (await req.json().catch(() => ({}))) as { name?: unknown }
    res = await renameMediaAction(id, typeof body.name === 'string' ? body.name : '')
  } else if (action === 'delete') {
    res = await deleteMediaAction(id)
  } else return json({ ok: false, error: 'not_found' }, 404)

  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
