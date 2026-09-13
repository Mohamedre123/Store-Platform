import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { blockedPayload } from '@/lib/app-blocked'

export const dynamic = 'force-dynamic'

/** GET /api/app/blocked — شاشة الحظر في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('orders.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await blockedPayload(ctx.store))
}
