import { NextResponse, type NextRequest } from 'next/server'
import { getDashboardContext } from '@/lib/store-context'
import { connectUrl, providerConfigured } from '@/lib/social-provider'
import { syncAccounts } from '@/lib/social'

export const dynamic = 'force-dynamic'

/**
 * ربط حسابات السوشيال.
 *
 * ## مسارين بس
 * `/api/social/start` بيفتح صفحة الربط عند خدمة النشر، و
 * `/api/social/sync` بيقرا اللي اتربط فعلًا ويحفظه.
 *
 * ## وليه مفيش `callback`
 * صفحة الربط ما بتردّش التاجر لعندنا — بيربط هناك وبيرجع بإيده.
 * فمفيش رحلة OAuth نستقبل ردّها، ومفيش `state` نوقّعه. القراءة
 * الصريحة هي الطريقة الوحيدة المضمونة: التاجر ممكن يكون قفل
 * الصفحة في نصّها، والصف اللي بيتكتب على أساس إشارة رجوع بيبان
 * حسابًا شغّالًا مش بينشر.
 */

function redirectBack(req: NextRequest, params: Record<string, string>) {
  const url = new URL('/dashboard/studio/accounts', req.nextUrl.origin)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ action: string }> }) {
  const { action } = await ctx.params

  /*
    الصلاحية بتتفحص في الاتنين.

    المسارين بيكتبوا على متجر التاجر — و`getDashboardContext` هي
    اللي بتحدّد أي متجر، مش أي حاجة جاية من المتصفح.
  */
  const { store, user } = await getDashboardContext()

  if (!providerConfigured()) {
    return redirectBack(req, { error: 'خدمة النشر لسه مش مضبوطة على المنصة. بلّغ الدعم.' })
  }

  /* ── فتح صفحة الربط ──────────────────────────────────── */
  if (action === 'start') {
    /*
      صفحة واحدة بتربط كل المنصات.

      فمفيش رحلة لكل منصة — التاجر بيروح، بيربط اللي عايزه، وبيرجع.
    */
    const url = await connectUrl(store.id)
    if (!url.ok) return redirectBack(req, { error: url.error })
    return NextResponse.redirect(url.data)
  }

  /* ── قراءة اللي اتربط ────────────────────────────────── */
  if (action === 'sync') {
    const res = await syncAccounts(store.id, user.id)
    if (!res.ok) return redirectBack(req, { error: res.error })

    if (res.data === 0) {
      return redirectBack(req, {
        error: 'لسه مفيش حساب مربوط. افتح صفحة الربط، اربط حسابك، وبعدين ارجع ودوس «حدّث».',
      })
    }

    return redirectBack(req, { connected: String(res.data) })
  }

  return NextResponse.json({ error: 'مسار مش معروف' }, { status: 404 })
}
