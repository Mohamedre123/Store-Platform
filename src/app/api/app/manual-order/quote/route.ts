import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { quoteManualOrder } from '@/app/dashboard/orders/new/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/manual-order/quote — حساب الطلب قبل الحفظ على الخادم (الشحن والضريبة والشحن المجاني والمخزون):
 * `{ lines, country, city, discount, shippingOverride, fulfillment }` — نفس `quoteManualOrder` في اللوحة.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  const res = await quoteManualOrder(body)
  if ('error' in res) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true, ...res })
}
