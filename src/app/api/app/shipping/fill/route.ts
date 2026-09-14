import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { ensureShippingZone } from '@/lib/app-shipping'
import { zonesFor } from '@/lib/shipping-zones'
import { applyZonePricesAction, fetchCarrierRatesAction } from '@/app/dashboard/shipping/actions'

export const dynamic = 'force-dynamic'

type FillResult = { ok?: boolean; error?: string; filled?: number; carrier?: string; applied?: Record<string, string> } | null

/**
 * POST /api/app/shipping/fill — ملء أسعار المحافظات مرة واحدة:
 * `{ mode: "carrier" }` تعريفة الشركة المربوطة، أو `{ mode: "zones", prices: { greater_cairo: "45" } }`.
 * الأسعار بتتكتب على طول (زي اللوحة) وبترجع في `applied`.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const country = ctx.store.country
  await ensureShippingZone(ctx.store)

  let res: FillResult
  if (body.mode === 'carrier') {
    res = await fetchCarrierRatesAction(country)
  } else {
    const src = body.prices && typeof body.prices === 'object' ? (body.prices as Record<string, unknown>) : {}
    const prices: Record<string, string> = {}
    for (const z of zonesFor(country)) if (typeof src[z.key] === 'string') prices[z.key] = (src[z.key] as string).slice(0, 12)
    res = await applyZonePricesAction(country, prices)
  }
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true, filled: res?.filled ?? 0, carrier: res?.carrier ?? null, applied: res?.applied ?? {} })
}
