import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { schedulesPayload } from '@/lib/app-schedules'

export const dynamic = 'force-dynamic'

/** GET /api/app/schedules — جداول النشر التلقائي وكل اللي الفورم محتاجه (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await schedulesPayload(ctx.store))
}
