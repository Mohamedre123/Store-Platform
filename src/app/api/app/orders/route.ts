import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { ordersListPayload } from '@/lib/app-orders'

export const dynamic = 'force-dynamic'

/** GET /api/app/orders?filter= — قايمة الطلبات في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET(req: NextRequest) {
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx

  const filter = req.nextUrl.searchParams.get('filter') ?? undefined
  return json(await ordersListPayload(ctx.store, filter))
}
