import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { approveReviewAction, deleteReviewAction, replyToReviewAction } from '@/app/dashboard/reviews/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/reviews/:id/{approve|reply|delete} — نفس أزرار صفحة المراجعات.
 *
 * - approve: `{ approve: boolean }` — نشر المراجعة أو إخفاؤها
 * - reply: `{ reply: string }` — رد المتجر (فاضي = مسح الرد)
 * - delete
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('customers.view')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)
  const body = (await req.json().catch(() => ({}))) as { approve?: unknown; reply?: unknown }

  let res: { error?: string } | null
  if (action === 'approve') res = (await approveReviewAction(id, body.approve === true)) as { error?: string } | null
  else if (action === 'reply') {
    const reply = typeof body.reply === 'string' ? body.reply.slice(0, 2000) : ''
    res = (await replyToReviewAction(id, reply)) as { error?: string } | null
  } else if (action === 'delete') res = (await deleteReviewAction(id)) as { error?: string } | null
  else return json({ ok: false, error: 'not_found' }, 404)

  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
