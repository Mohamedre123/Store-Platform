import { NextResponse, type NextRequest } from 'next/server'
import { appContext, json, sameOrigin } from '@/lib/app-api'
import { publishingEnabled, syncAccounts } from '@/lib/social'

export const dynamic = 'force-dynamic'

/**
 * POST /api/app/social-accounts/sync — «حدّث الحسابات»: يقرا اللي اتربط عند خدمة النشر ويحفظه.
 * نفس `/api/social/sync` بس بيرد JSON بدل التحويل لصفحة اللوحة.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ ok: false, error: 'forbidden' }, 403)
  const ctx = await appContext('marketing.manage')
  if (ctx instanceof NextResponse) return ctx

  if (!publishingEnabled()) return json({ ok: false, error: 'خدمة النشر لسه مش مضبوطة على المنصة. بلّغ الدعم.' }, 400)

  const res = await syncAccounts(ctx.store.id, ctx.user.id)
  if (!res.ok) return json({ ok: false, error: res.error }, 400)
  if (res.data === 0) {
    return json({ ok: false, error: 'لسه مفيش حساب مربوط. افتح صفحة الربط، اربط حسابك، وبعدين ارجع ودوس «حدّث».' }, 400)
  }
  return json({ ok: true, count: res.data })
}
