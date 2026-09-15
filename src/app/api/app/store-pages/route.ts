import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { loadStorePages } from '@/lib/store-pages-data'
import { PAGE_STARTERS } from '@/lib/page-starters'

export const dynamic = 'force-dynamic'

/** GET /api/app/store-pages — صفحات المتجر (الإرجاع والخصوصية والشروط) والنصوص الجاهزة */
export async function GET() {
  const ctx = await appContext('storefront.manage')
  if (ctx instanceof NextResponse) return ctx
  return json({ pages: await loadStorePages(ctx.store.id), starters: PAGE_STARTERS })
}
