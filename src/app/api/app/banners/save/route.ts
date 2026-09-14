import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveBannerAction, type BannerInput } from '@/app/dashboard/storefront/banners/actions'

export const dynamic = 'force-dynamic'

const PLACEMENTS: BannerInput['placement'][] = ['hero', 'promo', 'category', 'popup']
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const image = (v: unknown) => {
  const s = str(v, 1000)
  return /^https?:\/\//.test(s) ? s : null
}
const date = (v: unknown) => (/^\d{4}-\d{2}-\d{2}$/.test(str(v, 10)) ? str(v, 10) : '')

/**
 * POST /api/app/banners/save — بانر جديد أو تعديله.
 *
 * `{ id?, placement, title, subtitle, imageDesktop, imageMobile, ctaLabel, ctaUrl, startsAt, endsAt, isActive }` —
 * نفس `BannerInput` في فورم اللوحة (مكان النص والترتيب ما بيتلمسوش).
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('storefront.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const res = await saveBannerAction({
    id: str(body.id, 64) || undefined,
    placement: PLACEMENTS.find((p) => p === body.placement) ?? 'promo',
    title: str(body.title, 200),
    subtitle: str(body.subtitle, 300),
    imageDesktop: image(body.imageDesktop),
    imageMobile: image(body.imageMobile),
    ctaLabel: str(body.ctaLabel, 60),
    ctaUrl: str(body.ctaUrl, 500),
    startsAt: date(body.startsAt),
    endsAt: date(body.endsAt),
    isActive: body.isActive !== false,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
