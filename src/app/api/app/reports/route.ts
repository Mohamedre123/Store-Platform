import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { reportsPayload } from '@/lib/app-reports'

export const dynamic = 'force-dynamic'

/** GET /api/app/reports — تقارير مفصّلة: قنوات البيع، مصادر الطلبات، شركات الشحن، شغل الفريق (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('reports.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await reportsPayload(ctx))
}
