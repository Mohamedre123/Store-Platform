import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveAffiliateAction } from '@/app/dashboard/affiliates/actions'

export const dynamic = 'force-dynamic'

const str = (v: unknown) => (typeof v === 'string' ? v : '')

/**
 * POST /api/app/affiliates/save — `{ id?, name, phone, email, code, commissionType, commissionValue, isActive }`
 * (العمولة نسبة مئوية أو مبلغ بالجنيه زي فورم اللوحة).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const res = await saveAffiliateAction({
    id: str(body.id) || undefined,
    name: str(body.name),
    phone: str(body.phone),
    email: str(body.email),
    code: str(body.code),
    commissionType: body.commissionType === 'fixed' ? 'fixed' : 'percent',
    commissionValue: str(body.commissionValue)
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[٫,]/g, '.'),
    isActive: body.isActive !== false,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
