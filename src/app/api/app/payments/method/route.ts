import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { currentCod } from '@/lib/app-shipping'
import { savePaymentMethodAction } from '@/app/dashboard/payments/actions'

export const dynamic = 'force-dynamic'

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')

/**
 * POST /api/app/payments/method — الدفع عند الاستلام أو التحويل: `{ gateway, enabled, displayName, instructions, fixedFee }`.
 *
 * فتح الدفع عند الاستلام وقفله مش من هنا (`/api/app/shipping/cod`) — زي كارت اللوحة، حالته
 * بتتبعت زي ما هي في منطقة الشحن.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('settings.manage')
  if (ctx instanceof NextResponse) return ctx

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
  const gateway = body.gateway === 'cod' || body.gateway === 'manual' ? body.gateway : null
  if (!gateway) return json({ ok: false, error: 'طريقة الدفع دي مش معروفة' }, 400)

  const res = await savePaymentMethodAction({
    gateway,
    enabled: gateway === 'cod' ? await currentCod(ctx.store) : body.enabled === true,
    displayName: str(body.displayName, 80),
    instructions: str(body.instructions, 1000),
    fixedFee: gateway === 'cod' ? str(body.fixedFee, 12) : '',
  })
  if (res?.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
