import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { changePasswordAction } from '@/app/dashboard/account/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/account/password — `{ current, next }` تغيير كلمة السر **بالحالية** (نفس الفعل).
 * الرد عمره ما بيرجّع أي جزء من الكلمتين.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext()
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  try {
    const res = await changePasswordAction({ current: body.current, next: body.next })
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  } catch {
    return json({ ok: false, error: 'ما قدرناش نغيّر كلمة السر — جرّب تاني' }, 400)
  }
}
