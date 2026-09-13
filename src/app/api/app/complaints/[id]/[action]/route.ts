import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { replyTicketAction, setTicketStatusAction } from '@/app/dashboard/complaints/actions'
import { TICKET_STATUSES } from '@/lib/tickets-meta'

export const dynamic = 'force-dynamic'

type Status = 'open' | 'answered' | 'resolved' | 'closed'

/**
 * POST /api/app/complaints/:id/{reply|status} — نفس أزرار صفحة الشكاوى.
 *
 * أفعال اللوحة بتتحقق من `orders.manage` بنفسها وبترمي لو مش مسموح —
 * هنا الرمية دي بتتحوّل لرد ٤٠٣ برسالتها العربي بدل خطأ خادم.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)
  const body = (await req.json().catch(() => ({}))) as { body?: unknown; status?: unknown }

  try {
    let res: { error?: string } | null
    if (action === 'reply') {
      res = await replyTicketAction({ ticketId: id, body: typeof body.body === 'string' ? body.body : '' })
    } else if (action === 'status') {
      const status = TICKET_STATUSES.find((s) => s.key === body.status)?.key as Status | undefined
      if (!status) return json({ ok: false, error: 'اختار حالة صحيحة' }, 400)
      res = await setTicketStatusAction(id, status)
    } else return json({ ok: false, error: 'not_found' }, 404)

    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  } catch (e) {
    const message = e instanceof Error ? e.message : ''
    if (message.includes('صلاحية')) return json({ ok: false, error: message }, 403)
    throw e
  }
}
