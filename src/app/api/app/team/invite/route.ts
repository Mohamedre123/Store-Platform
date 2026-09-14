import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { inviteMemberAction } from '@/app/dashboard/settings/team/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/team/invite — دعوة عضو: `{ email, role, permissions }`.
 * نفس «اعمل رابط الدعوة» في اللوحة: بيرجّع `inviteUrl` وبيبعت الدعوة على البريد (`emailed`).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('team.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  try {
    const res = await inviteMemberAction({
      email: typeof body.email === 'string' ? body.email.slice(0, 120) : '',
      role: body.role === 'admin' ? 'admin' : 'staff',
      permissions: Array.isArray(body.permissions) ? body.permissions.filter((p) => typeof p === 'string').slice(0, 20) : [],
    })
    if (res?.error || !res?.inviteUrl) return json({ ok: false, error: res?.error ?? 'مقدرناش نعمل الدعوة' }, 400)
    return json({ ok: true, inviteUrl: res.inviteUrl, emailed: Boolean(res.emailed) })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'مقدرناش نعمل الدعوة' }, 400)
  }
}
