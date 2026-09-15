import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { improveTextAction } from '@/app/dashboard/ai-actions'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * POST /api/app/improve — `{ task, current, fields?, hint? }` ← `{ suggestions }`.
 * نفس زرار «تحسين» اللي جنب حقول النص في اللوحة (بمفتاح التاجر). `needsSetup` = مفيش مفتاح شغّال.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext()
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  try {
    const res = await improveTextAction(body)
    if (!res.ok) return json({ ok: false, error: res.error, needsSetup: Boolean(res.needsSetup) }, 400)
    return json({ ok: true, suggestions: res.suggestions })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
