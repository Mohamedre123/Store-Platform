import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { currentCod } from '@/lib/app-shipping'
import { saveZoneAction } from '@/app/dashboard/shipping/actions'

export const dynamic = 'force-dynamic'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const days = (v: unknown) => Math.max(0, Math.min(365, Math.trunc(Number(v) || 0)))

/**
 * POST /api/app/shipping/zone — الإعدادات العامة:
 * `{ enabled, defaultPrice, freeShippingEnabled, freeOverAmount, minDays, maxDays }`.
 * الدفع عند الاستلام بيتبعت بحالته الحالية (ليه مفتاحه لوحده).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const res = await saveZoneAction({
    country: ctx.store.country,
    enabled: body.enabled !== false,
    defaultPrice: str(body.defaultPrice, 12),
    freeShippingEnabled: body.freeShippingEnabled === true,
    freeOverAmount: str(body.freeOverAmount, 12),
    minDays: days(body.minDays),
    maxDays: days(body.maxDays),
    codEnabled: await currentCod(ctx.store),
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
