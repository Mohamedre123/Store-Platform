import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { orderSettingsValues } from '@/lib/order-settings-data'

export const dynamic = 'force-dynamic'

/** GET /api/app/order-settings — الطلب اليدوي وترقيم الطلبات (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx
  return json({ values: orderSettingsValues(ctx.store) })
}
