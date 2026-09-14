import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { automationsPayload } from '@/lib/app-automations'

export const dynamic = 'force-dynamic'

/** GET /api/app/automations — قواعد الأتمتة ومستقبلو الإشعارات في تطبيق الموبايل */
export async function GET() {
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await automationsPayload(ctx.store))
}
