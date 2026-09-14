import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { revokeOtherSessionsAction, revokeSessionAction } from '@/app/dashboard/settings/sessions/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/sessions/:id/revoke — قفل جلسة جهاز (المستخدم بيقفل جلساته هو بس).
 * POST /api/app/sessions/others/revoke — قفل كل الأجهزة التانية (الجهاز ده بيفضل مفتوح) — بيرجّع `closed`.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext()
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (id === 'others') {
    const res = await revokeOtherSessionsAction()
    return json({ ok: true, closed: res?.closed ?? 0 })
  }
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: 'not_found' }, 404)

  const res = await revokeSessionAction(id)
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
