import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { socialAccountsPayload } from '@/lib/app-social'

export const dynamic = 'force-dynamic'

/** GET /api/app/social-accounts — حسابات السوشيال المربوطة وطريقة الربط (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await socialAccountsPayload(ctx.store.id))
}
