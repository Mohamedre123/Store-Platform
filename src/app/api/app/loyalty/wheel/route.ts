import { NextResponse, type NextRequest } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { wheelPrizes, wheelSettings } from '@/db/schema'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { wheelPrizeInputs } from '@/lib/loyalty-data'
import { saveWheelAction, type WheelPrizeInput } from '@/app/dashboard/loyalty/wheel-actions'

export const dynamic = 'force-dynamic'

const TYPES: WheelPrizeInput['type'][] = ['points', 'coupon_percent', 'coupon_fixed', 'free_shipping', 'nothing']
const latin = (v: unknown) =>
  String(v ?? '')
    .trim()
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[٫,]/g, '.')
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : null)

/**
 * POST /api/app/loyalty/wheel — عجلة الحظ.
 *
 * - `{ enabled }` بس (نسخ التطبيق 2.3 و2.4): تشغيل/إيقاف — العنوان والجوايز الموجودين بيتبعتوا زي ما هم.
 * - من 2.5 كمان `title, subtitle, triggerAfterSeconds, freeSpinsPerDay, prizes: [{ label, color, type, value, chance }]`
 *   (القيمة والفرصة زي خانات فورم اللوحة). أي خانة مش مبعوتة بتفضل زي ما هي.
 *
 * `saveWheelAction` بيكتب الإعدادات والجوايز من الأول.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('customers.view')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const [[w], rows] = await Promise.all([
    db.select().from(wheelSettings).where(eq(wheelSettings.storeId, ctx.store.id)).limit(1),
    db.select().from(wheelPrizes).where(eq(wheelPrizes.storeId, ctx.store.id)).orderBy(wheelPrizes.position),
  ])

  const prizes: WheelPrizeInput[] = Array.isArray(body.prizes)
    ? body.prizes.slice(0, 8).map((raw) => {
        const p = raw as Record<string, unknown>
        return {
          label: str(p.label, 40) ?? '',
          color: typeof p.color === 'string' && /^#[0-9a-f]{6}$/i.test(p.color) ? p.color : '#634b9a',
          type: TYPES.find((t) => t === p.type) ?? 'nothing',
          value: latin(p.value) || '0',
          chance: latin(p.chance) || '0',
        }
      })
    : wheelPrizeInputs(rows)

  const res = await saveWheelAction({
    enabled: body.enabled === true,
    title: str(body.title, 60) ?? w?.title ?? 'جرّب حظك',
    subtitle: str(body.subtitle, 120) ?? w?.subtitle ?? '',
    triggerAfterSeconds: body.triggerAfterSeconds !== undefined ? latin(body.triggerAfterSeconds) : String(w?.triggerAfterSeconds ?? 15),
    freeSpinsPerDay: body.freeSpinsPerDay !== undefined ? latin(body.freeSpinsPerDay) : String(w?.freeSpinsPerDay ?? 1),
    prizes,
  })
  if (res?.error) {
    const hint = !Array.isArray(body.prizes) && rows.length < 2 ? ' — ضيف الجوايز من «عدّل العجلة» الأول' : ''
    return json({ ok: false, error: `${res.error}${hint}` }, 400)
  }
  return json({ ok: true })
}
