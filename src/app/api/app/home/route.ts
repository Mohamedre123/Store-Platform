import { NextResponse } from 'next/server'
import { getOptionalDashboardContext } from '@/lib/store-context'
import { loadHomeData } from '@/lib/home-data'
import { publicStoreUrl } from '@/lib/domain'
import { formatOrderNumber } from '@/lib/order-number'
import { statusMeta } from '@/lib/order-status'
import { getPlan } from '@/lib/plans'

export const dynamic = 'force-dynamic'

/*
  بيانات تاجر — ما يصحّش تتخزّن في أي كاش وسيط، ولا ترجع لجلسة تانية
  من كاش المتصفح بعد تسجيل الخروج.
*/
const NO_STORE = { 'Cache-Control': 'private, no-store' }

/**
 * GET /api/app/home — الشاشة الرئيسية لتطبيق الموبايل.
 *
 * ## بجلسة اللوحة نفسها
 * التطبيق بيفتح المنصة على نفس النطاق، فكوكي الجلسة بتوصل هنا زي أي
 * صفحة في اللوحة. مفيش توكن تاني يتسرّب أو ينتهي لوحده.
 *
 * ## والرد ٤٠١ لا تحويل
 * صفحات اللوحة بتحوّل على `/login`. هنا التحويل كان هيرجّع HTML صفحة
 * الدخول لكود بيستنى JSON — والتطبيق يقع بدل ما يعرف إن الجلسة خلصت.
 *
 * المبالغ بالوحدة الصغرى (قرش) زي باقي المنصة، والتطبيق بينسّقها.
 */
export async function GET() {
  const ctx = await getOptionalDashboardContext()
  if (!ctx) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: NO_STORE })
  }

  const { store, user } = ctx
  const data = await loadHomeData(store)
  const plan = data.ent.plan ?? getPlan(store.plan)

  return NextResponse.json(
    {
      store: {
        id: store.id,
        name: store.name,
        currency: store.currency,
        logo: store.logoLight,
        url: publicStoreUrl(store),
        published: store.isPublished,
      },
      user: { name: user.name },
      subscription: {
        active: data.ent.active,
        isAdmin: data.ent.isAdmin,
        onTrial: data.ent.onTrial,
        expired: data.ent.expired,
        daysLeft: data.ent.daysLeft,
        endsAt: data.ent.until ? data.ent.until.toISOString() : null,
        planName: plan?.name ?? (data.ent.isAdmin ? 'إدارة المنصة' : 'مجانية'),
        periodDays: plan?.days ?? 30,
        quota: { used: data.quota.used, limit: data.quota.limit, blocked: data.quota.blocked },
      },
      counts: data.counts,
      stats: data.stats,
      setup: data.setup,
      notices: data.notices.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        ctaLabel: n.ctaLabel,
        ctaHref: n.ctaHref,
        tone: n.tone,
        rewardKind: n.rewardKind,
        redeemed: n.redeemedUntil !== null,
      })),
      latestOrders: data.latestOrders.map((o) => ({
        id: o.id,
        number: formatOrderNumber(store, o.number),
        name: o.name,
        total: o.total,
        status: o.status,
        statusLabel: statusMeta(o.status).label,
      })),
      topProducts: data.topProducts,
      generatedAt: new Date().toISOString(),
    },
    { headers: NO_STORE },
  )
}
