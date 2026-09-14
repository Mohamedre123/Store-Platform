import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { teamPayload } from '@/lib/app-settings'

export const dynamic = 'force-dynamic'

/** GET /api/app/team — أعضاء الفريق وصلاحياتهم والدعوات المستنية (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await teamPayload(ctx))
}
