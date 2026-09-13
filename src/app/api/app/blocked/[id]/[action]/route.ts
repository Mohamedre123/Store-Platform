import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { removeBlockAction, setCustomerBlockedAction } from '@/app/dashboard/customers/block-actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/blocked/:id/{remove|block|unblock}
 *
 * - remove: `:id` صف في قايمة الحظر
 * - block / unblock: `:id` عميل — نفس زرار «احظره / فُكّ الحظر» (الصف والرقم مع بعض)
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  let res: { error?: string } | null
  if (action === 'remove') res = await removeBlockAction(id)
  else if (action === 'block' || action === 'unblock') res = await setCustomerBlockedAction(id, action === 'block')
  else return json({ ok: false, error: 'not_found' }, 404)

  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
