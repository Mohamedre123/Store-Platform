import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveReceiptAction } from '@/app/dashboard/settings/receipt/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/receipt/save — نفس جسم `saveReceiptAction` */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  try {
    const res = await saveReceiptAction(body)
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
