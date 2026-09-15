import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { seoValues } from '@/lib/seo-data'
import { publicStoreUrl } from '@/lib/domain'
import { SEO_LIMITS } from '@/lib/seo-template'

export const dynamic = 'force-dynamic'

/** GET /api/app/seo — الظهور والسيو ووضع الصيانة و«قريبًا» (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx
  return json({
    values: seoValues(ctx.store),
    storeName: ctx.store.name,
    storeUrl: publicStoreUrl(ctx.store),
    limits: SEO_LIMITS,
  })
}
