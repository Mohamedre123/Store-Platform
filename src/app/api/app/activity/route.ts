import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { activityPayload } from '@/lib/app-settings'

export const dynamic = 'force-dynamic'

/** GET /api/app/activity — سجل النشاط: مين عمل إيه في المتجر (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await activityPayload(ctx.store.id))
}
