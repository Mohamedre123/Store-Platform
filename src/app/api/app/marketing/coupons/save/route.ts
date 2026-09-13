import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveCouponAction } from '@/app/dashboard/marketing/actions'

export const dynamic = 'force-dynamic'

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '')
const latin = (v: unknown) =>
  str(v, 30)
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
const pick = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(v as T) ? (v as T) : fallback

/**
 * POST /api/app/marketing/coupons/save — كوبون جديد أو تعديله من التطبيق.
 *
 * نفس خانات فورم اللوحة (`CouponInput`) بالظبط — النسبة رقم من ١ لـ١٠٠ والمبالغ بالجنيه
 * والتواريخ `YYYY-MM-DD`، و`saveCouponAction` هو اللي بيتحقق ويحوّل.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v, 10)) ? str(v, 10) : '')

  const res = await saveCouponAction({
    id: str(body.id, 64) || undefined,
    code: str(body.code, 40),
    description: str(body.description, 300),
    type: pick(body.type, ['percent', 'fixed', 'free_shipping'] as const, 'percent'),
    value: latin(body.value),
    maxDiscount: latin(body.maxDiscount),
    minOrder: latin(body.minOrder),
    appliesTo: pick(body.appliesTo, ['all', 'products', 'categories'] as const, 'all'),
    targetIds: Array.isArray(body.targetIds)
      ? body.targetIds.filter((x): x is string => typeof x === 'string' && /^[\w-]{6,64}$/.test(x)).slice(0, 500)
      : [],
    eligibility: pick(body.eligibility, ['all', 'first_order', 'tier', 'specific_customers'] as const, 'all'),
    usageLimit: latin(body.usageLimit),
    usageLimitPerCustomer: latin(body.usageLimitPerCustomer) || '1',
    startsAt: date(body.startsAt),
    endsAt: date(body.endsAt),
    isActive: body.isActive !== false,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
