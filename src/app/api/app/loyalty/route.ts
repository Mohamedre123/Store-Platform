import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { loyaltyPayload } from '@/lib/app-loyalty'

export const dynamic = 'force-dynamic'

/** GET /api/app/loyalty — الولاء والنقاط والمكافآت والعجلة في تطبيق الموبايل */
export async function GET() {
  const ctx = await appContext('customers.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await loyaltyPayload(ctx.store))
}
