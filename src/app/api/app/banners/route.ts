import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { bannersPayload } from '@/lib/app-banners'

export const dynamic = 'force-dynamic'

/** GET /api/app/banners — بانرات المتجر في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('storefront.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await bannersPayload(ctx.store))
}
