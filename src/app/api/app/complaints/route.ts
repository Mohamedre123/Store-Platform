import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { complaintsPayload } from '@/lib/app-complaints'

export const dynamic = 'force-dynamic'

/** GET /api/app/complaints — الشكاوى في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await complaintsPayload(ctx))
}
