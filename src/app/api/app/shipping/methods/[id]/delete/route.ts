import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { deleteShippingMethodAction } from '@/app/dashboard/shipping/methods-actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/shipping/methods/:id/delete — حذف طريقة شحن (الطلبات القديمة ما بتتأثرش) */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: 'not_found' }, 404)
  const res = await deleteShippingMethodAction(id)
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
