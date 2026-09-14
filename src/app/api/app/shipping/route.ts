import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { shippingPayload } from '@/lib/app-shipping'

export const dynamic = 'force-dynamic'

/** GET /api/app/shipping — إعدادات الشحن والمحافظات والشركات والطرق (نفس صفحة اللوحة، من غير أي مفتاح) */
export async function GET() {
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await shippingPayload(ctx.store))
}
