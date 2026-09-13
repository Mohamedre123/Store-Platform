import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { setReturnNoteAction, updateReturnStatusAction } from '@/app/dashboard/returns/actions'
import { RETURN_STATUSES, type ReturnStatus } from '@/lib/returns-meta'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/returns/:id/{status|note} — نفس أزرار صفحة المرتجعات.
 *
 * - status: `{ status }` — واحدة من `RETURN_STATUSES`
 * - note: `{ note }` — ملاحظة التاجر (فاضية = مسح)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)
  const body = (await req.json().catch(() => ({}))) as { status?: unknown; note?: unknown }

  let res: { error?: string } | null
  if (action === 'status') {
    const status = RETURN_STATUSES.find((s) => s.key === body.status)?.key as ReturnStatus | undefined
    if (!status) return json({ ok: false, error: 'اختار حالة صحيحة' }, 400)
    res = (await updateReturnStatusAction(id, status)) as { error?: string } | null
  } else if (action === 'note') {
    const note = typeof body.note === 'string' ? body.note.slice(0, 1000) : ''
    res = (await setReturnNoteAction(id, note)) as { error?: string } | null
  } else return json({ ok: false, error: 'not_found' }, 404)

  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
