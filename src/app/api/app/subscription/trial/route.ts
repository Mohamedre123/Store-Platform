import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { startTrialAction } from '@/app/dashboard/subscription/actions'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/subscription/trial — بدء التجربة المجانية من التطبيق.
 *
 * نفس فعل الصفحة بالحرف (مرة واحدة، ولمين ما اشتركش قبل كده)،
 * وإيميل «تجربتك بدأت» بيتبعت من جوّاه.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('team.manage')
  if (ctx instanceof NextResponse) return ctx

  const res = await startTrialAction()
  if (res.error) return json({ ok: false, error: res.error }, 400)
  return json({ ok: true })
}
