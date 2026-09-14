import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { deleteRecipientAction, testRecipientAction, toggleRecipientAction } from '@/app/dashboard/automations/recipient-actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/automations/recipients/:id/{toggle|delete|test}
 *
 * - toggle: `{ isActive }`
 * - delete: حذف المستقبِل
 * - test: إشعار تجريبي بنفس القناة والمسار الحقيقي
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  let res: { error?: string } | null
  if (action === 'toggle') {
    const body = (await req.json().catch(() => ({}))) as { isActive?: unknown }
    res = await toggleRecipientAction(id, body.isActive === true)
  } else if (action === 'delete') {
    res = await deleteRecipientAction(id)
  } else if (action === 'test') {
    res = await testRecipientAction(id)
  } else return json({ ok: false, error: 'not_found' }, 404)

  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
