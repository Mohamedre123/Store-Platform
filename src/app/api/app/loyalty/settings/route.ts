import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { getLoyaltySettings } from '@/lib/loyalty'
import { DEFAULT_TIERS } from '@/lib/loyalty-meta'
import { saveLoyaltyAction } from '@/app/dashboard/loyalty/actions'

export const dynamic = 'force-dynamic'

const latin = (v: unknown, fallback: number) => {
  if (typeof v !== 'string' && typeof v !== 'number') return String(fallback)
  return String(v)
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
}

/**
 * POST /api/app/loyalty/settings — تشغيل النقاط وقواعدها.
 *
 * `{ enabled, pointsPerPound, pointValue, minPointsToRedeem, welcomePoints, reviewPoints, referralPoints }`.
 * **المستويات بتتبعت زي ما هي من القاعدة** (أو الافتراضية لو لسه ما اتحفظتش — زي فورم اللوحة)،
 * لأن `saveLoyaltyAction` بيكتبها كلها والتطبيق ما بيعدّلهاش.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('customers.view')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const s = await getLoyaltySettings(ctx.store.id)

  const res = await saveLoyaltyAction({
    enabled: body.enabled === true,
    pointsPerPound: latin(body.pointsPerPound, s?.pointsPerUnit ?? 1),
    pointValue: latin(body.pointValue, s?.pointValue ?? 1),
    minPointsToRedeem: latin(body.minPointsToRedeem, s?.minPointsToRedeem ?? 100),
    welcomePoints: latin(body.welcomePoints, s?.welcomePoints ?? 0),
    reviewPoints: latin(body.reviewPoints, s?.reviewPoints ?? 0),
    referralPoints: latin(body.referralPoints, s?.referralPoints ?? 0),
    tiers: s?.tiers?.length ? s.tiers : DEFAULT_TIERS,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
