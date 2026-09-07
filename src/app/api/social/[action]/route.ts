import { NextResponse, type NextRequest } from 'next/server'
import { getDashboardContext } from '@/lib/store-context'
import { encryptJson, decryptJson } from '@/lib/crypto'
import {
  metaAuthUrl,
  metaExchange,
  saveAccount,
  tiktokAuthUrl,
  tiktokExchange,
  metaConfigured,
  tiktokConfigured,
} from '@/lib/social'

export const dynamic = 'force-dynamic'

/**
 * ربط حسابات السوشيال.
 *
 * `/api/social/start?platform=facebook` بيوجّه لشاشة الموافقة،
 * و`/api/social/callback?platform=facebook` بيستقبل الرد.
 *
 * ## ليه الحالة مشفَّرة لا معرّف خام
 * `state` بيروح لفيسبوك وبيرجع من متصفح الزائر — يعني حد يقدر
 * يعدّله. لو كان معرّف المتجر خام، أي حد بيبدّله بمعرّف متجر تاني
 * ويربط صفحته بمتجر مش بتاعه. التشفير بيخلّي التعديل يفكّ لـ
 * `null` وبنرفض.
 *
 * ## والصلاحية بتتفحص وقت البداية **ووقت الرجوع**
 * الجلسة ممكن تكون انتهت وهو على شاشة فيسبوك. الفحص مرة واحدة كان
 * بيخلّي التوكن يتكتب على متجر من غير جلسة صالحة.
 */

type State = { storeId: string; userId: string; ts: number }

/** ربع ساعة — الرحلة لفيسبوك ورجوع مش بتاخد أكتر */
const STATE_TTL = 15 * 60 * 1000

function redirectBack(req: NextRequest, params: Record<string, string>) {
  const url = new URL('/dashboard/studio/accounts', req.nextUrl.origin)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
  return NextResponse.redirect(url)
}

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ action: string }> },
) {
  const { action } = await ctx.params
  const platform = req.nextUrl.searchParams.get('platform') ?? ''

  const redirectUri = `${req.nextUrl.origin}/api/social/callback?platform=${platform}`

  /* ── البداية ─────────────────────────────────────────── */
  if (action === 'start') {
    const { store, user } = await getDashboardContext()

    if (platform === 'facebook' || platform === 'instagram') {
      if (!metaConfigured()) return redirectBack(req, { error: 'ربط فيسبوك مش مضبوط على المنصة' })
    } else if (platform === 'tiktok') {
      if (!tiktokConfigured()) return redirectBack(req, { error: 'ربط تيك توك مش مضبوط على المنصة' })
    } else {
      return redirectBack(req, { error: 'منصة مش معروفة' })
    }

    const state = encryptJson({ storeId: store.id, userId: user.id, ts: Date.now() })

    /*
      فيسبوك وإنستجرام نفس الرحلة.

      حساب إنستجرام بيتربط من خلال صفحة فيسبوك أصلًا — ورحلة منفصلة
      كانت هتخلّي التاجر يوافق مرتين على نفس الحاجة.
    */
    const url =
      platform === 'tiktok'
        ? tiktokAuthUrl(redirectUri, state)
        : metaAuthUrl(redirectUri, state)

    return NextResponse.redirect(url)
  }

  /* ── الرجوع ──────────────────────────────────────────── */
  if (action === 'callback') {
    const code = req.nextUrl.searchParams.get('code')
    const raw = req.nextUrl.searchParams.get('state')
    const denied = req.nextUrl.searchParams.get('error_description')

    if (denied) return redirectBack(req, { error: denied.slice(0, 200) })
    if (!code || !raw) return redirectBack(req, { error: 'الربط اتلغى' })

    const state = decryptJson<State>(raw)
    if (!state?.storeId || Date.now() - state.ts > STATE_TTL) {
      return redirectBack(req, { error: 'الرابط انتهت صلاحيته — ابدأ الربط تاني' })
    }

    /*
      الجلسة بتتفحص تاني والمتجر لازم يطابق.

      التاجر ممكن يكون فتح متجرًا تاني في تبويب تاني وهو على شاشة
      فيسبوك. الكتابة على المتجر اللي في الحالة من غير المطابقة
      كانت هتربط الصفحة بمتجر هو مش فاتحه دلوقتي.
    */
    const { store, user } = await getDashboardContext()
    if (store.id !== state.storeId) {
      return redirectBack(req, { error: 'المتجر اتغيّر أثناء الربط — ابدأ تاني' })
    }

    if (platform === 'tiktok') {
      const res = await tiktokExchange(code, redirectUri)
      if (!res.ok) return redirectBack(req, { error: res.error })

      await saveAccount({
        storeId: store.id,
        userId: user.id,
        account: res.data,
        refreshToken: res.data.refreshToken || null,
        expiresAt: new Date(Date.now() + res.data.expiresIn * 1000),
      })

      return redirectBack(req, {
        connected: res.data.canPublish ? '1' : 'draft',
      })
    }

    const res = await metaExchange(code, redirectUri)
    if (!res.ok) return redirectBack(req, { error: res.error })

    for (const account of res.data) {
      await saveAccount({ storeId: store.id, userId: user.id, account })
    }

    return redirectBack(req, { connected: String(res.data.length) })
  }

  return NextResponse.json({ error: 'مسار مش معروف' }, { status: 404 })
}
