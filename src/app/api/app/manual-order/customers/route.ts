import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { searchOrderCustomers } from '@/app/dashboard/orders/new/actions'

export const dynamic = 'force-dynamic'

/** GET /api/app/manual-order/customers?q= — عملاء المتجر بالرقم أو الاسم ومعاهم آخر عنوان */
export async function GET(req: NextRequest) {
  const ctx = await appContext('orders.manage')
  if (ctx instanceof NextResponse) return ctx
  const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 80)
  return json({ customers: await searchOrderCustomers(q) })
}
