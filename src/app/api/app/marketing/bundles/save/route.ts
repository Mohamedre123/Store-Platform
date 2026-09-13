import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveBundleAction } from '@/app/dashboard/marketing/offer-actions'

export const dynamic = 'force-dynamic'

const str = (v: unknown, max = 120) => (typeof v === 'string' ? v.slice(0, max) : '')

/**
 * POST /api/app/marketing/bundles/save — باقة جديدة أو تعديلها.
 *
 * `{ id?, name, badge, productIds, bundlePrice, isActive }` — السعر بالجنيه زي فورم اللوحة
 * (`BundleInput`)، والفعل بيتأكد إنها منتجين على الأقل.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const res = await saveBundleAction({
    id: str(body.id, 64) || undefined,
    name: str(body.name, 80),
    badge: str(body.badge, 40),
    productIds: Array.isArray(body.productIds)
      ? body.productIds.filter((x): x is string => typeof x === 'string' && /^[\w-]{6,64}$/.test(x)).slice(0, 50)
      : [],
    bundlePrice: String(body.bundlePrice ?? '')
      .trim()
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[٫,]/g, '.'),
    isActive: body.isActive !== false,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
