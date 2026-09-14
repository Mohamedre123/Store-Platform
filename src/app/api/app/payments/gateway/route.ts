import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { providerValues } from '@/lib/app-providers'
import { paymentProvider } from '@/lib/providers'
import { savePaymentProviderAction } from '@/app/dashboard/payments/provider-actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/payments/gateway — ربط بوابة دفع أو تشغيلها/إيقافها: `{ slug, enabled, values, testMode }`.
 *
 * نفس «احفظ وفعّل» في كارت اللوحة (بيتسجّل في سجل النشاط). الخانة السرّية الفاضية = سيب المحفوظ.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const def = paymentProvider(typeof body.slug === 'string' ? body.slug : '')
  if (!def) return json({ ok: false, error: 'البوابة دي مش معروفة' }, 400)

  const res = await savePaymentProviderAction({
    slug: def.slug,
    enabled: body.enabled === true,
    values: providerValues(def, body.values),
    testMode: body.testMode === true,
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
