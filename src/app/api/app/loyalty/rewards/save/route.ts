import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveRewardAction } from '@/app/dashboard/loyalty/rewards-actions'

export const dynamic = 'force-dynamic'

const latin = (v: unknown) =>
  String(v ?? '')
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')

/**
 * POST /api/app/loyalty/rewards/save — مكافأة جديدة أو تعديلها.
 *
 * `{ id?, name, description, type, value, pointsCost, minTier, limited, stock, isActive }` —
 * القيمة نسبة مئوية أو مبلغ بالجنيه زي فورم اللوحة، و`stock` بيتحفظ بس لو `limited`.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('customers.view')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const res = await saveRewardAction({
    id: typeof body.id === 'string' && body.id ? body.id : undefined,
    name: body.name,
    description: typeof body.description === 'string' ? body.description : undefined,
    type: body.type,
    value: latin(body.value) || '0',
    pointsCost: latin(body.pointsCost),
    minTier: typeof body.minTier === 'string' && body.minTier ? body.minTier : null,
    stock: body.limited === true ? latin(body.stock) || '0' : null,
    isActive: body.isActive !== false,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
