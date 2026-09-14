import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { deleteScheduleAction, runScheduleNowAction } from '@/app/dashboard/studio/actions'

export const dynamic = 'force-dynamic'
/* «جرّبه» بيولّد صورة وكلام (وأحيانًا فيديو) — نفس مهلة صفحة الاستوديو */
export const maxDuration = 300

/**
 * POST /api/app/schedules/:id/run — «جرّبه»: يعمل بوست دلوقتي ويحطّه في البوستات.
 * POST /api/app/schedules/:id/delete — حذف الجدول.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const { id, action } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ ok: false, error: 'not_found' }, 404)

  try {
    if (action === 'run') {
      const res = await runScheduleNowAction(id)
      if (res.error) return json({ ok: false, error: res.error }, 400)
      return json({ ok: true })
    }
    if (action === 'delete') {
      await deleteScheduleAction(id)
      return json({ ok: true })
    }
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
  return json({ ok: false, error: 'not_found' }, 404)
}
