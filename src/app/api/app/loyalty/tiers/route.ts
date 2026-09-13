import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { getLoyaltySettings } from '@/lib/loyalty'
import { DEFAULT_TIERS } from '@/lib/loyalty-meta'
import { saveLoyaltyAction } from '@/app/dashboard/loyalty/actions'
import type { TierConfig } from '@/db/schema'

export const dynamic = 'force-dynamic'

const KEYS: TierConfig['key'][] = ['bronze', 'silver', 'gold', 'platinum']
const COLORS: Record<TierConfig['key'], string> = { bronze: '#a1662f', silver: '#8a8f98', gold: '#c9a227', platinum: '#634b9a' }
const latin = (v: unknown) =>
  Number(
    String(v ?? '')
      .trim()
      .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
      .replace(/[٫,]/g, '.'),
  ) || 0

/**
 * POST /api/app/loyalty/tiers — `{ tiers: [{ key, name, minPoints, discountPercent }] }` مستويات العملاء.
 *
 * كل قواعد النقاط التانية بتتبعت زي ما هي من القاعدة (`saveLoyaltyAction` بيكتب كل حاجة)، واللون
 * والمزايا بيتاخدوا من المستوى الموجود بنفس المفتاح — التطبيق ما بيعدّلهمش.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('customers.view')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as { tiers?: unknown }
  const s = await getLoyaltySettings(ctx.store.id)
  const existing = s?.tiers?.length ? s.tiers : DEFAULT_TIERS

  if (!Array.isArray(body.tiers)) return json({ ok: false, error: 'بيانات ناقصة' }, 400)
  const tiers: TierConfig[] = body.tiers.slice(0, 4).flatMap((raw) => {
    const t = raw as Record<string, unknown>
    const key = KEYS.find((k) => k === t.key)
    const name = typeof t.name === 'string' ? t.name.trim().slice(0, 30) : ''
    if (!key || !name) return []
    const old = existing.find((x) => x.key === key)
    return [
      {
        key,
        name,
        minPoints: Math.max(0, Math.trunc(latin(t.minPoints))),
        discountBps: Math.min(9000, Math.max(0, Math.round(latin(t.discountPercent) * 100))),
        color: old?.color ?? COLORS[key],
        perks: old?.perks ?? [],
      },
    ]
  })
  if (tiers.length === 0) return json({ ok: false, error: 'ضيف مستوى واحد على الأقل باسم' }, 400)

  const res = await saveLoyaltyAction({
    enabled: s?.enabled ?? false,
    pointsPerPound: String(s?.pointsPerUnit ?? 1),
    pointValue: String(s?.pointValue ?? 1),
    minPointsToRedeem: String(s?.minPointsToRedeem ?? 100),
    welcomePoints: String(s?.welcomePoints ?? 0),
    reviewPoints: String(s?.reviewPoints ?? 0),
    referralPoints: String(s?.referralPoints ?? 0),
    tiers,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
