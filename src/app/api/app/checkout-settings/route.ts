import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { checkoutPayload } from '@/lib/app-settings-pages'

export const dynamic = 'force-dynamic'

/** GET /api/app/checkout-settings — خانات الشيك أوت والدفع السريع والسلة والتأكيد (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await checkoutPayload(ctx))
}
