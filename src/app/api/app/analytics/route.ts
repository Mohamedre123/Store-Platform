import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { analyticsPayload } from '@/lib/app-analytics'

export const dynamic = 'force-dynamic'

/** GET /api/app/analytics — التحليلات في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('reports.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await analyticsPayload(ctx.store))
}
