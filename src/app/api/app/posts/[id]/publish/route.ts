import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { publishPostAction } from '@/app/dashboard/studio/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/posts/:id/publish — نشر بوست محفوظ: `{ targets? }` (معرّفات الحسابات للبوست اللي اتحفظ من غيرها).
 * نفس «انشر» في اللوحة؛ النتيجة لكل حساب بتتسجّل على البوست حتى لو فشل.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const targets = Array.isArray(body.targets)
    ? body.targets.filter((t): t is string => typeof t === 'string' && isRecordId(t)).slice(0, 20)
    : []

  try {
    const res = await publishPostAction(id, targets.length ? targets : undefined)
    if (res.error) return json({ ok: false, error: res.error, results: res.results ?? [] }, 400)
    return json({ ok: true, results: res.results ?? [] })
  } catch (e) {
    /* الإضافة مقفولة — الفعل بيرمي برسالة عربي */
    return json({ ok: false, error: e instanceof Error ? e.message : 'مقدرناش ننشر' }, 400)
  }
}
