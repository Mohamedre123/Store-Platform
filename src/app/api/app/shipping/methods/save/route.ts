import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { toMinorUnits } from '@/lib/utils'
import { saveShippingMethodAction } from '@/app/dashboard/shipping/methods-actions'

export const dynamic = 'force-dynamic'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const days = (v: unknown) => {
  if (v === '' || v === null || v === undefined) return null
  const n = Math.trunc(Number(v))
  return Number.isFinite(n) ? n : null
}

/**
 * POST /api/app/shipping/methods/save — طريقة شحن جديدة أو تعديلها:
 * `{ id?, name, hint, priceDelta, minDays, maxDays, enabled, sortOrder }` — فرق السعر بالجنيه (ممكن سالب).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const id = typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : undefined
  const res = await saveShippingMethodAction({
    id,
    name: str(body.name, 40),
    hint: str(body.hint, 80) || null,
    priceDelta: toMinorUnits(str(String(body.priceDelta ?? ''), 12) || 0),
    minDays: days(body.minDays),
    maxDays: days(body.maxDays),
    enabled: body.enabled !== false,
    sortOrder: Math.max(0, Math.min(99, Math.trunc(Number(body.sortOrder) || 0))),
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true, id: res?.id ?? null })
}
