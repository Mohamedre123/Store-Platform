import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { affiliatesPayload } from '@/lib/app-affiliates'

export const dynamic = 'force-dynamic'

/** GET /api/app/affiliates — المسوّقون بالعمولة في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await affiliatesPayload(ctx.store))
}
