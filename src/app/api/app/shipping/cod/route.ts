import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveCodAction } from '@/app/dashboard/shipping/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/shipping/cod — فتح/قفل الدفع عند الاستلام `{ enabled }` (من شاشة الشحن وشاشة الدفع) */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const res = await saveCodAction(ctx.store.country, body.enabled === true)
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
