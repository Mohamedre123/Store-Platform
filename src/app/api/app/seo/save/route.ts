import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveSeoAction } from '@/app/dashboard/settings/seo/actions'

export const dynamic = 'force-dynamic'

/** POST /api/app/seo/save — نفس جسم `saveSeoAction` (بيفحص وسوم الرأس وبيرفض السكربتات) */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  try {
    const res = await saveSeoAction(body)
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
