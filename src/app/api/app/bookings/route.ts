import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { bookingsPayload } from '@/lib/app-bookings'

export const dynamic = 'force-dynamic'

/** GET /api/app/bookings — شاشة الحجوزات في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await bookingsPayload(ctx.store))
}
