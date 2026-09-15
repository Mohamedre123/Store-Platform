import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { whatsappPayload } from '@/lib/app-settings-pages'

export const dynamic = 'force-dynamic'

/** GET /api/app/whatsapp — حالة ربط واتساب المتجر ونصوص الرسايل (نفس صفحة اللوحة — من غير أي مفتاح) */
export async function GET() {
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await whatsappPayload(ctx))
}
