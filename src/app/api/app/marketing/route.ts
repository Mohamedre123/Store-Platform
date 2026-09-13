import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { marketingPayload } from '@/lib/app-marketing'

export const dynamic = 'force-dynamic'

/** GET /api/app/marketing — الكوبونات والعروض والباقات في تطبيق الموبايل */
export async function GET() {
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await marketingPayload(ctx.store))
}
