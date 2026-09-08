import { NextResponse, type NextRequest } from 'next/server'
import { getDashboardContext } from '@/lib/store-context'
import { encryptJson, decryptJson } from '@/lib/crypto'
import { connectUrl, listConnected, profileFor } from '@/lib/social-provider'
import {
  metaAuthUrl,
  metaExchange,
  saveAccount,
  tiktokAuthUrl,
  tiktokExchange,
  metaConfigured,
  tiktokConfigured,
  routeFor,
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

/**
 * قراءة حسابات الوسيط وحفظها.
 *
 * بنقرا الحالة الحقيقية بدل ما نصدّق أي رابط: التاجر ممكن يكون
 * قفل الصفحة في نصّها، والصف اللي بيتكتب على أساس الرابط بيبان
 * حسابًا شغّالًا مش بينشر.
 */
async function syncProvider(req: NextRequest) {
  const { store, user } = await getDashboardContext()

  const found = await listConnected(store.id)
  if (!found.ok) return redirectBack(req, { error: found.error })

  if (found.data.length === 0) {
    return redirectBack(req, {
      error: 'لسه مفيش حساب مربوط. افتح صفحة الربط، اربط حسابك، وبعدين ارجع ودوس «حدّث».',
    })
  }

  for (const acc of found.data) {
    await saveAccount({
      storeId: store.id,
      userId: user.id,
      account: {
        platform: acc.platform,
        externalId: acc.externalId,
        name: acc.name,
        avatar: acc.avatar,
        /*
          مفيش توكن بيوصلنا — الوسيط ماسكه.

          والعمود `notNull`، فبنحط علامة واضحة بدل نص فاضي بيبان
          توكنًا مكسورًا لأي حد بيقرا الجدول بعدين.
        */
        accessToken: 'provider',
        canPublish: true,
      },
      provider: 'uploadpost',
      providerProfile: profileFor(store.id),
    })
  }

  return redirectBack(req, { connected: String(found.data.length) })
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

    if (platform !== 'facebook' && platform !== 'instagram' && platform !== 'tiktok') {
      return redirectBack(req, { error: 'منصة مش معروفة' })
    }

    /*
      الوسيط بيغلب لو مضبوط.

      عنده الموافقات جاهزة، فالتاجر بيربط دلوقتي بدل ما يستنّى
      مراجعة ميتا وتوثيق النشاط. ولو تطبيقنا اتوافق عليه بعدين،
      شيل مفتاح الوسيط والربط بيرجع مباشر — والحسابات القديمة
      بتفضل شغّالة لأن `provider` متخزّن على كل صف.
    */
    if (routeFor(platform) === 'uploadpost') {
      /*
        صفحة الوسيط بتربط كل المنصات مرة واحدة.

        فمفيش لزوم لرحلة لكل منصة — التاجر بيروح، بيربط اللي عايزه،
        وبيرجع. والمنصة في الرابط بتتجاهل هنا عن قصد.
      */
      const url = await connectUrl(store.id)
      if (!url.ok) return redirectBack(req, { error: url.error })
      return NextResponse.redirect(url.data)
    }

    if (platform === 'facebook' || platform === 'instagram') {
      if (!metaConfigured()) return redirectBack(req, { error: 'ربط فيسبوك مش مضبوط على المنصة' })
    } else if (!tiktokConfigured()) {
      return redirectBack(req, { error: 'ربط تيك توك مش مضبوط على المنصة' })
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
  /*
    مزامنة الوسيط — فعل صريح لا رجوع تلقائي.

    صفحة الوسيط ما بتردّش التاجر لعندنا، فمفيش رابط رجوع نستقبله.
    التاجر بيرجع بإيده ويدوس «حدّث» — وبنقرا اللي اتربط فعلًا.
  */
  if (action === 'sync') return syncProvider(req)

  if (action === 'callback') {
    /*
      رجوع الوسيط مالوش `code` ولا `state`.

      الربط حصل عنده، فبنقرا **اللي اتربط فعلًا** بدل ما نصدّق
      الرابط — الرابط بيرجع «تمام» حتى لو التاجر قفل الشاشة في
      نصّها، والصف الفاضي كان هيبان حسابًا شغّالًا مش بينشر.
    */
    if (req.nextUrl.searchParams.get('via') === 'provider') {
      return syncProvider(req)
    }

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
