import { NextResponse, type NextRequest } from 'next/server'
import { appContext, isRecordId, json, sameOrigin } from '@/lib/app-api'
import { toggleCouponAction } from '@/app/dashboard/marketing/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/marketing/coupons/:id/toggle — تفعيل الكوبون أو إيقافه (نفس زرار اللوحة) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!isRecordId(id)) return json({ ok: false, error: 'not_found' }, 404)
  const body = (await req.json().catch(() => null)) as { isActive?: unknown } | null

  const res = (await toggleCouponAction(id, body?.isActive === true)) as { error?: string } | null
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
