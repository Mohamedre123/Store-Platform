import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveProfileAction } from '@/app/dashboard/account/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/account/profile — `{ name, phone }` (البريد ما بيتغيّرش من هنا — زي الصفحة) */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext()
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  try {
    const res = await saveProfileAction({ name: body.name, phone: body.phone })
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
