import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { addBlockAction } from '@/app/dashboard/customers/block-actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/blocked/add — `{ match, value, action, reason }` نفس فورم «ضيف للحظر» */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const res = await addBlockAction({
    match: body.match,
    value: typeof body.value === 'string' ? body.value : '',
    action: body.action === 'flag' ? 'flag' : 'reject',
    reason: typeof body.reason === 'string' && body.reason.trim() ? body.reason : null,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
