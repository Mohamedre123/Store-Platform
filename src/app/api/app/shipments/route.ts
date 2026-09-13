import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { shipmentsPayload } from '@/lib/app-shipments'

export const dynamic = 'force-dynamic'

/** GET /api/app/shipments — الشحنات في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await shipmentsPayload(ctx.store))
}
