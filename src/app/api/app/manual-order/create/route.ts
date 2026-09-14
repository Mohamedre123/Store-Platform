import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { createManualOrderAction } from '@/app/dashboard/orders/new/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/manual-order/create — تسجيل الطلب اليدوي. نفس `createManualOrderAction` بالحرف (حصّة الباقة،
 * السعر المخصص في سجل النشاط، الخصم ما يعدّيش المجموع). بيرجّع `orderId` و`orderNumber`.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('orders.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  const res = await createManualOrderAction(body)
  if (!res || 'error' in res) return json({ ok: false, error: res?.error ?? 'حصلت مشكلة' }, 400)
  return json({ ok: true, orderId: res.orderId, orderNumber: res.orderNumber })
}
