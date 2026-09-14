import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { paymentsPayload } from '@/lib/app-payments'

export const dynamic = 'force-dynamic'

/** GET /api/app/payments — طرق الدفع والبوابات ومحاولات الدفع (نفس صفحة اللوحة، من غير أي مفتاح) */
export async function GET() {
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await paymentsPayload(ctx.store))
}
