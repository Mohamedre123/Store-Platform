import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { deleteRuleAction, toggleRuleAction } from '@/app/dashboard/automations/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/automations/rules/:id/{toggle|delete}
 *
 * - toggle: `{ enabled }` تشغيل القاعدة أو إيقافها
 * - delete: حذف القاعدة
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  let res: { error?: string } | null
  if (action === 'toggle') {
    const body = (await req.json().catch(() => ({}))) as { enabled?: unknown }
    res = await toggleRuleAction(id, body.enabled === true)
  } else if (action === 'delete') {
    res = await deleteRuleAction(id)
  } else return json({ ok: false, error: 'not_found' }, 404)

  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
