import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveAutoShipAction } from '@/app/dashboard/shipping/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/shipping/auto-ship — تسجيل الشحنة تلقائيًا لما الطلب يتأكّد `{ enabled }` */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const res = await saveAutoShipAction(body.enabled === true)
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
