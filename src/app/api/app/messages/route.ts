import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { messagesPayload } from '@/lib/app-messages'

export const dynamic = 'force-dynamic'

/** GET /api/app/messages — سجل الرسايل في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('orders.view')
  if (ctx instanceof NextResponse) return ctx
  return json(await messagesPayload(ctx.store))
}
