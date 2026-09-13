import { NextResponse } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { referralSummary } from '@/lib/merchant-referrals'
import { storeStats } from '@/lib/notices'

export const dynamic = 'force-dynamic'

/**
 * GET /api/app/referrals — «حِيل صاحبك» في تطبيق الموبايل.
 *
 * من غير صلاحية — زي صفحة اللوحة: رابط إحالة المتجر وعدّاده، مفيش فيها بيانات عملاء ولا فلوس.
 */
export async function GET() {
  const ctx = await appContext()
  if (ctx instanceof NextResponse) return ctx

  const [summary, stats] = await Promise.all([referralSummary(ctx.store.id), storeStats(ctx.store.id)])
  return json({
    storeName: ctx.store.name,
    link: summary.link,
    code: summary.code,
    signups: summary.signups,
    subscribed: summary.subscribed,
    deliveredOrders: stats.deliveredOrders,
  })
}
