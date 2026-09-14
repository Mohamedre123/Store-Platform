import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { setMemberBlockedAction, updateMemberAction } from '@/app/dashboard/settings/team/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/team/members/:id/update — `{ role, permissions }` (صلاحيات المالك ما بتتغيّرش).
 * POST /api/app/team/members/:id/block — `{ blocked }` إيقاف عضو أو رجوعه.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('team.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: 'not_found' }, 404)
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  try {
    let res: { ok?: boolean; error?: string } | null = null
    if (action === 'update') {
      res = await updateMemberAction({
        memberId: id,
        role: body.role === 'admin' ? 'admin' : 'staff',
        permissions: Array.isArray(body.permissions) ? body.permissions.filter((p) => typeof p === 'string').slice(0, 20) : [],
      })
    } else if (action === 'block') {
      res = await setMemberBlockedAction(id, body.blocked === true)
    } else {
      return json({ ok: false, error: 'not_found' }, 404)
    }
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
