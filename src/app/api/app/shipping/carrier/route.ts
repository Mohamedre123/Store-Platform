import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { providerValues } from '@/lib/app-providers'
import { carrierProvider } from '@/lib/providers'
import { saveCarrierProviderAction } from '@/app/dashboard/payments/provider-actions'

export const dynamic = 'force-dynamic'

const money = (v: unknown, max: number) => {
  const n = Number(String(v ?? '').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? Math.min(Math.max(n, 0), max) : 0
}

/**
 * POST /api/app/shipping/carrier — ربط شركة شحن أو تشغيلها/إيقافها:
 * `{ slug, enabled, values, testMode, flatRate, freeOver }` (السعر بالجنيه). نفس كارت اللوحة.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const def = carrierProvider(typeof body.slug === 'string' ? body.slug : '')
  if (!def) return json({ ok: false, error: 'الشركة دي مش معروفة' }, 400)

  const res = await saveCarrierProviderAction({
    slug: def.slug,
    enabled: body.enabled === true,
    values: providerValues(def, body.values),
    testMode: body.testMode === true,
    flatRate: money(body.flatRate, 100000),
    freeOver: money(body.freeOver, 1000000),
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
