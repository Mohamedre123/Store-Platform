import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { disconnectAccountAction } from '@/app/dashboard/studio/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/social-accounts/:id/disconnect — فصل حساب (البوستات المجدولة عليه بتقف) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  try {
    await disconnectAccountAction(id)
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'مقدرناش نفصله' }, 400)
  }
}
