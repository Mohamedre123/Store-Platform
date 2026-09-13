import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveSupplierAction } from '@/app/dashboard/suppliers/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/suppliers/save — `{ id?, name, phone, email, margin, isActive }` (الهامش نسبة مئوية) */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('inventory.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const marginText = String(body.margin ?? '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')

  const res = await saveSupplierAction({
    id: typeof body.id === 'string' && body.id ? body.id : undefined,
    name: body.name,
    phone: typeof body.phone === 'string' ? body.phone : undefined,
    email: typeof body.email === 'string' ? body.email : undefined,
    defaultMarginPercent: marginText ? Number(marginText) : 30,
    isActive: body.isActive !== false,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true, id: res?.id ?? null })
}
