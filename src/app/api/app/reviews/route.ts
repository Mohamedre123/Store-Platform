import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { reviewsPayload } from '@/lib/app-reviews'

export const dynamic = 'force-dynamic'

/** GET /api/app/reviews — المراجعات في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('customers.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await reviewsPayload(ctx.store))
}
