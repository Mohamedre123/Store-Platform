import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { ensureShippingZone } from '@/lib/app-shipping'
import { regionsFor } from '@/lib/regions'
import { saveRatesAction } from '@/app/dashboard/shipping/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/shipping/rates — أسعار المحافظات `{ rates: { "القاهرة": "45", "أسوان": "" } }`.
 *
 * المحافظة اللي مش في الطلب ما بتتلمسش، واللي سعرها فاضي بترجع للسعر الافتراضي (زي اللوحة).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const src = body.rates && typeof body.rates === 'object' ? (body.rates as Record<string, unknown>) : {}
  const rates = regionsFor(ctx.store.country)
    .filter((r) => typeof src[r.name] === 'string')
    .map((r) => ({ city: r.name, price: (src[r.name] as string).slice(0, 12), enabled: true }))
  if (!rates.length) return json({ ok: false, error: 'مفيش أسعار اتبعتت' }, 400)

  await ensureShippingZone(ctx.store)
  const res = await saveRatesAction(ctx.store.country, rates)
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
