import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { removeDomainAction, saveDomainAction, verifyDomainAction } from '@/app/dashboard/settings/domain/actions'

export const dynamic = 'force-dynamic'
/* التحقّق بيسأل الـDNS والمستضيف */
export const maxDuration = 60

/**
 * POST /api/app/domain/:action — `save` `{domain}` · `verify` · `remove`.
 * الرد دايمًا `{ ok: true, state }` بنفس `DomainState` بتاع الصفحة (فيه `error` أو `notice`) —
 * «سجلاتك لسه ما انتشرتش» مش فشل للطلب، دي حالة التاجر لازم يشوفها.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ action: string }> }) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const { action } = await params
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>

  try {
    if (action === 'save') {
      const form = new FormData()
      form.set('domain', typeof body.domain === 'string' ? body.domain.slice(0, 253) : '')
      const state = await saveDomainAction(null, form)
      return json({ ok: true, state: { error: state?.error, notice: state?.notice } })
    }
    if (action === 'verify') {
      const state = await verifyDomainAction()
      return json({ ok: true, state: { error: state?.error, notice: state?.notice, verified: state?.verified } })
    }
    if (action === 'remove') {
      const state = await removeDomainAction()
      return json({ ok: true, state: { error: state?.error, notice: state?.notice } })
    }
    return json({ ok: false, error: 'not_found' }, 404)
  } catch (e) {
    return json({ ok: false, error: e instanceof Error ? e.message : 'حصلت مشكلة' }, 400)
  }
}
