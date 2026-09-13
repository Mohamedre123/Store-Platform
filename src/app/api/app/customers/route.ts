import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { customersListPayload } from '@/lib/app-customers'

export const dynamic = 'force-dynamic'

/** GET /api/app/customers?filter= — قايمة العملاء في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET(req: NextRequest) {
  const ctx = await appContext('customers.view')
  if (ctx instanceof NextResponse) return ctx

  const filter = req.nextUrl.searchParams.get('filter') ?? undefined
  return json(await customersListPayload(ctx.store, filter))
}
