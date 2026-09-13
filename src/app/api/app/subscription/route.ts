import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { subscriptionPayload } from '@/lib/app-subscription'

export const dynamic = 'force-dynamic'

/** GET /api/app/subscription — الاشتراك في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('team.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await subscriptionPayload(ctx.store, ctx.user))
}
