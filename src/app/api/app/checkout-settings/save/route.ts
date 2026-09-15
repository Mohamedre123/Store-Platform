import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { saveCheckoutSettingsAction } from '@/app/dashboard/settings/checkout/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/checkout-settings/save — نفس جسم `saveCheckoutSettingsAction` (كل الخانات، والمبلغ بالقرش).
 * الفعل بيتحقق من كل قيمة وبيرفض إخفاء الاسم والرقم.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = await req.json().catch(() => ({}))
  try {
    const res = await saveCheckoutSettingsAction(body)
    if (res?.error) return json({ ok: false, error: res.error }, 400)
    return json({ ok: true })
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
