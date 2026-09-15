import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { loadReceipt } from '@/lib/receipt-data'

export const dynamic = 'force-dynamic'

/** GET /api/app/receipt — إعدادات صفحة الطلب والإيصال (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await loadReceipt(ctx.store))
}
