import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { sendDeliveryTestAction } from '@/app/dashboard/settings/email/actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** POST /api/app/email/test — `{to}` رسالة تجريبية بنفس قالب وترويسات رسايل العملاء */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as { to?: unknown }
  try {
    const res = await sendDeliveryTestAction(typeof body.to === 'string' ? body.to.slice(0, 200) : '')
    if (!res.ok) return json({ ok: false, error: res.message }, 400)
    return json({ ok: true, message: res.message, from: res.from })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
