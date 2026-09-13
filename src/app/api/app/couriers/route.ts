import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { couriersPayload } from '@/lib/app-couriers'

export const dynamic = 'force-dynamic'

/** GET /api/app/couriers — شاشة المندوبين في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('orders.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await couriersPayload(ctx.store))
}
