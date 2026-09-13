import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { blogPayload } from '@/lib/app-blog'

export const dynamic = 'force-dynamic'

/** GET /api/app/blog — مقالات المدوّنة في تطبيق الموبايل (نفس صفحة اللوحة) */
export async function GET() {
  const ctx = await appContext('storefront.manage')
  if (ctx instanceof NextResponse) return ctx
  return json(await blogPayload(ctx.store))
}
