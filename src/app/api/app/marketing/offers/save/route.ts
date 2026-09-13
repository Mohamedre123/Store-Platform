import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveOfferAction } from '@/app/dashboard/marketing/offer-actions'

export const dynamic = 'force-dynamic'

const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.slice(0, max) : '')
const latin = (v: unknown) =>
  String(v ?? '')
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
const ids = (v: unknown) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[\w-]{6,64}$/.test(x)).slice(0, 500) : []

/**
 * POST /api/app/marketing/offers/save — عرض كمية جديد أو تعديله.
 *
 * `{ id?, name, badge, tiers: [{ qty, percent }], productIds, isActive }` — نفس `OfferInput` في فورم اللوحة
 * (`productIds` فاضي = كل المنتجات).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const tiers = Array.isArray(body.tiers)
    ? body.tiers.slice(0, 10).map((t) => ({
        qty: latin((t as { qty?: unknown })?.qty),
        percent: latin((t as { percent?: unknown })?.percent),
      }))
    : []

  const res = await saveOfferAction({
    id: str(body.id, 64) || undefined,
    name: str(body.name),
    badge: str(body.badge, 40),
    tiers,
    productIds: ids(body.productIds),
    isActive: body.isActive !== false,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
