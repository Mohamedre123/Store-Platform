import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { returnsPayload } from '@/lib/app-returns'

export const dynamic = 'force-dynamic'

/** GET /api/app/returns — المرتجعات في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await returnsPayload(ctx.store))
}
