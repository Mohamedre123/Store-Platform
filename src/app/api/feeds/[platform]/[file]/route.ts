import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { marketplaceConnections } from '@/db/schema'
import {
  feedItems,
  googleFeed,
  marketplaceDef,
  metaFeed,
  touchCatalogFeed,
} from '@/lib/marketplace'
import { publicStoreUrl } from '@/lib/domain'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * ملف الكتالوج العام.
 *
 * ميتا وجوجل وتيك توك بيجيبوا الملف ده من سيرفراتهم كل يوم من غير
 * أي مصادقة — مفيش طريقة نحطّ عليه مفتاحًا. عشان كده:
 *
 * ١. **مفيش فيه أي بيانات عملاء.** منتجات وأسعار وصور بس، وكلها
 *    ظاهرة لأي زائر في المتجر أصلًا.
 * ٢. **بيشتغل بس لو التاجر فعّل المنصة.** المعرّف في الرابط مش سرّ،
 *    فالتفعيل هو الإذن — واللي مش مفعّل بيرجّع ٤٠٤ حتى لو حد خمّن
 *    الرابط.
 * ٣. **الرد بيتخزّن مؤقتًا نص ساعة.** المنصات بتجيبه مرة في اليوم،
 *    بس التاجر بيفتحه بنفسه عشان يتأكد — والتخزين بيمنع إن كل فتحة
 *    تعمل استعلامًا على ٥٠٠٠ منتج.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ platform: string; file: string }> },
) {
  const { platform, file } = await params

  const def = marketplaceDef(platform)
  if (!def) return new NextResponse('unknown platform', { status: 404 })

  // اسم الملف هو معرّف المتجر + الامتداد
  const storeId = file.replace(/\.(xml|csv)$/i, '')
  if (!/^[0-9a-f-]{36}$/i.test(storeId)) {
    return new NextResponse('bad store', { status: 400 })
  }

  const [conn] = await db
    .select({ enabled: marketplaceConnections.enabled })
    .from(marketplaceConnections)
    .where(
      and(
        eq(marketplaceConnections.storeId, storeId),
        eq(marketplaceConnections.platform, platform),
      ),
    )
    .limit(1)

  if (!conn?.enabled) return new NextResponse('not connected', { status: 404 })

  const { items, store } = await feedItems(storeId)
  if (!store) return new NextResponse('store not found', { status: 404 })

  void touchCatalogFeed(storeId, platform, items.length)

  const headers = {
    'Cache-Control': 'public, max-age=1800, s-maxage=1800',
    'Content-Disposition': `inline; filename="${platform}-catalog.${def.format === 'google' ? 'xml' : 'csv'}"`,
  }

  if (def.format === 'google') {
    return new NextResponse(googleFeed(items, store.name, publicStoreUrl(store)), {
      headers: { ...headers, 'Content-Type': 'application/xml; charset=utf-8' },
    })
  }

  return new NextResponse(metaFeed(items), {
    headers: { ...headers, 'Content-Type': 'text/csv; charset=utf-8' },
  })
}
