import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveScheduleAction } from '@/app/dashboard/studio/actions'
import { PRESETS, STYLES, type ImageStyle, type PresetKey } from '@/lib/studio-meta'

export const dynamic = 'force-dynamic'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const ids = (v: unknown, max: number) =>
  Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && /^[\w-]{6,64}$/.test(x)).slice(0, max) : []

/**
 * POST /api/app/schedules/save — جدول نشر جديد أو تعديله. نفس فورم `SchedulesManager` بالحرف:
 * `{ id?, name, days, timeOfDay, targets, source, categoryId, productIds, style, preset, media, slides,
 *    imageStyle, aiProvider, aiTextModel, aiImageModel, autoPublish, isActive }`.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const days = Array.isArray(body.days)
    ? [...new Set(body.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort((a, b) => a - b)
    : []
  const provider = body.aiProvider === 'gemini' || body.aiProvider === 'openai' ? body.aiProvider : null

  try {
    const res = await saveScheduleAction({
      id: typeof body.id === 'string' && /^[0-9a-f-]{36}$/i.test(body.id) ? body.id : undefined,
      name: str(body.name, 60),
      days,
      timeOfDay: /^\d{2}:\d{2}$/.test(str(body.timeOfDay, 5)) ? str(body.timeOfDay, 5) : '',
      targets: ids(body.targets, 20),
      source: body.source === 'category' || body.source === 'products' ? body.source : 'auto',
      categoryId: typeof body.categoryId === 'string' && body.categoryId ? body.categoryId.slice(0, 64) : null,
      productIds: ids(body.productIds, 60),
      style: str(body.style, 600) || null,
      preset: (PRESETS.find((p) => p.key === body.preset)?.key ?? 'portrait') as PresetKey,
      media: body.media === 'carousel' || body.media === 'video' ? body.media : 'image',
      slides: Number(body.slides) || 5,
      imageStyle: (STYLES.find((s) => s.key === body.imageStyle)?.key ?? 'auto') as ImageStyle,
      aiProvider: provider,
      aiTextModel: str(body.aiTextModel, 120) || null,
      aiImageModel: str(body.aiImageModel, 120) || null,
      autoPublish: body.autoPublish === true,
      isActive: body.isActive !== false,
    })
    if (res.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true, id: res.id ?? null })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'مقدرناش نحفظ الجدول' }, 400)
  }
}
