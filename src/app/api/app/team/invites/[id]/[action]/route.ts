import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { cancelInviteAction, resendInviteAction } from '@/app/dashboard/settings/team/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/team/invites/:id/resend — رابط جديد + إيميل تاني لنفس الدعوة (بيرجّع `inviteUrl` و`emailed`).
 * POST /api/app/team/invites/:id/cancel — إلغاء دعوة لسه ما اتقبلتش.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('team.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: 'not_found' }, 404)

  try {
    if (action === 'resend') {
      const res = await resendInviteAction(id)
      if (res?.error || !res?.inviteUrl) return json({ ok: false, error: res?.error ?? 'مقدرناش نبعتها' }, 400)
      return json({ ok: true, inviteUrl: res.inviteUrl, emailed: Boolean(res.emailed) })
    }
    if (action === 'cancel') {
      await cancelInviteAction(id)
      return json({ ok: true })
    }
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
  return json({ ok: false, error: 'not_found' }, 404)
}
