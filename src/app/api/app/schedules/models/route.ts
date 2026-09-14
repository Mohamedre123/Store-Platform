import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json } from '@/lib/app-api'
import { listAiModelsAction } from '@/app/dashboard/studio/actions'

export const dynamic = 'force-dynamic'

/**
 * GET /api/app/schedules/models?provider= — موديلات مفتاح التاجر (الكلام والصور) لاختيار موديل الجدول.
 * نفس `AiModelPicker` في اللوحة: القايمة من المزوّد نفسه.
 */
export async function GET(req: NextRequest) {
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  const raw = req.nextUrl.searchParams.get('provider')
  const provider = raw === 'gemini' || raw === 'openai' ? raw : null
  try {
    return json(await listAiModelsAction({ provider }))
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'مقدرناش نجيب الموديلات' })
  }
}
