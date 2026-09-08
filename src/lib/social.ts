import 'server-only'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { socialAccounts } from '@/db/schema'
import { encrypt, decrypt } from './crypto'
import type { SocialPlatform } from './studio-meta'
import { providerConfigured, publishViaProvider } from './social-provider'

/**
 * النشر على السوشيال.
 *
 * ## تطبيق واحد للمنصة لا تطبيق لكل تاجر
 * فيسبوك وتيك توك الاتنين بيطلبوا تطبيق مطوّر متوافَق عليه عشان
 * ينشر. لو كل تاجر لازم يعمل تطبيقه ويستنّى مراجعة أسبوع، الميزة
 * ما بيستخدمهاش حد. فالتطبيق بتاعنا، والتاجر بيدوس «اربط» ويوافق
 * على الصلاحيات وخلاص.
 *
 * **والـAPI نفسه ببلاش.** لا فيسبوك ولا تيك توك بياخدوا فلوس على
 * النشر — التكلفة الوحيدة هي المراجعة، ومرة واحدة علينا.
 *
 * ## واللي ما ربطش بياخد الميزة برضو
 * البوست بيتخزّن جاهزًا (صورة ونص وهاشتاجات) في «جاهز للنشر»،
 * والتاجر بينزّله وينشره بإيده. الربط بيحوّلها لتلقائية — لا
 * بيخلّيها تشتغل من أصلها.
 */

const GRAPH = 'https://graph.facebook.com/v21.0'
const TIKTOK = 'https://open.tiktokapis.com/v2'

export type SocialResult<T> = { ok: true; data: T } | { ok: false; error: string }

/* ══════════════════════════════════════════════════════════════
   إعداد المنصة
   ══════════════════════════════════════════════════════════════ */

export function metaConfigured(): boolean {
  return Boolean(process.env.META_APP_ID && process.env.META_APP_SECRET)
}

export function tiktokConfigured(): boolean {
  return Boolean(process.env.TIKTOK_CLIENT_KEY && process.env.TIKTOK_CLIENT_SECRET)
}

/** إيه المتاح دلوقتي — الشاشة بتخبّي اللي مش مضبوط بدل ما تعطّل التاجر */
/**
 * المتاح دلوقتي.
 *
 * الوسيط بيغطّي التلاتة مرة واحدة. ولو تطبيقنا مضبوط كمان، الاتنين
 * بيبقوا متاحين — والتاجر بيختار، والقديم ما بيتكسرش.
 */
export function availablePlatforms(): SocialPlatform[] {
  if (providerConfigured()) return ['facebook', 'instagram', 'tiktok']

  const out: SocialPlatform[] = []
  if (metaConfigured()) out.push('facebook', 'instagram')
  if (tiktokConfigured()) out.push('tiktok')
  return out
}

/** الربط بيمشي على الوسيط؟ — الشاشة بتوضّح الفرق للتاجر */
export function usingProvider(): boolean {
  return providerConfigured()
}

/* ══════════════════════════════════════════════════════════════
   الربط — فيسبوك وإنستجرام
   ══════════════════════════════════════════════════════════════ */

/**
 * الصلاحيات المطلوبة.
 *
 * أقل مجموعة تنشر فعلًا. كل صلاحية زيادة بتطوّل المراجعة وبتخوّف
 * التاجر في شاشة الموافقة — واللي بيتخضّ بيقفلها.
 */
const META_SCOPES = [
  'pages_show_list',
  'pages_manage_posts',
  'pages_read_engagement',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
].join(',')

export function metaAuthUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.META_APP_ID ?? '',
    redirect_uri: redirectUri,
    state,
    scope: META_SCOPES,
    response_type: 'code',
  })
  return `https://www.facebook.com/v21.0/dialog/oauth?${q}`
}

export type DiscoveredAccount = {
  platform: SocialPlatform
  externalId: string
  name: string
  avatar: string | null
  accessToken: string
  canPublish: boolean
}

/**
 * تبديل الكود بصفحات التاجر وحساباته.
 *
 * ## التوكن بيتطوّل عمره فورًا
 * توكن الكود عمره ساعة. لو خزّنّاه زي ما هو، أول بوست مجدوَل بكرة
 * بيفشل والتاجر يفتكر الربط بايظ. التبديل للطويل بيخلّيه شهرين،
 * وتوكن الصفحة اللي بييجي منه عمليًا بلا انتهاء.
 */
export async function metaExchange(
  code: string,
  redirectUri: string,
): Promise<SocialResult<DiscoveredAccount[]>> {
  const appId = process.env.META_APP_ID
  const appSecret = process.env.META_APP_SECRET
  if (!appId || !appSecret) return { ok: false, error: 'ربط فيسبوك مش مضبوط على المنصة' }

  try {
    const short = await fetchJson<{ access_token?: string; error?: { message?: string } }>(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        }),
    )
    if (!short?.access_token) {
      return { ok: false, error: friendlyMetaError(short?.error?.message) }
    }

    const long = await fetchJson<{ access_token?: string }>(
      `${GRAPH}/oauth/access_token?` +
        new URLSearchParams({
          grant_type: 'fb_exchange_token',
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: short.access_token,
        }),
    )

    const userToken = long?.access_token ?? short.access_token

    const pages = await fetchJson<{
      data?: Array<{
        id: string
        name: string
        access_token: string
        picture?: { data?: { url?: string } }
        instagram_business_account?: { id: string; username?: string }
      }>
    }>(
      `${GRAPH}/me/accounts?` +
        new URLSearchParams({
          fields: 'id,name,access_token,picture{url},instagram_business_account{id,username}',
          access_token: userToken,
          limit: '50',
        }),
    )

    const found: DiscoveredAccount[] = []

    for (const page of pages?.data ?? []) {
      found.push({
        platform: 'facebook',
        externalId: page.id,
        name: page.name,
        avatar: page.picture?.data?.url ?? null,
        accessToken: page.access_token,
        canPublish: true,
      })

      /*
        حساب إنستجرام بيتربط بتوكن **الصفحة** لا بتوكن المستخدم.

        النشر على إنستجرام بيمشي من خلال الصفحة المربوطة بيه، وتوكن
        المستخدم بيرجّع «صلاحية ناقصة» برد مالوش علاقة بالسبب.
      */
      const ig = page.instagram_business_account
      if (ig?.id) {
        found.push({
          platform: 'instagram',
          externalId: ig.id,
          name: ig.username ? '@' + ig.username : page.name,
          avatar: page.picture?.data?.url ?? null,
          accessToken: page.access_token,
          canPublish: true,
        })
      }
    }

    if (found.length === 0) {
      return {
        ok: false,
        error:
          'مالقيناش صفحات في حسابك. لازم تكون أدمن على صفحة فيسبوك واحدة على الأقل — ' +
          'ولإنستجرام، حسابك لازم يكون «أعمال» ومربوط بالصفحة.',
      }
    }

    return { ok: true, data: found }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'مقدرناش نكمّل الربط' }
  }
}

/* ══════════════════════════════════════════════════════════════
   الربط — تيك توك
   ══════════════════════════════════════════════════════════════ */

export function tiktokAuthUrl(redirectUri: string, state: string): string {
  const q = new URLSearchParams({
    client_key: process.env.TIKTOK_CLIENT_KEY ?? '',
    /*
      `video.publish` بيغطّي بوستات الصور كمان — تيك توك مسمّيهاش
      كده من أيام ما كان فيديو بس، والاسم ما اتغيّرش.
    */
    scope: 'user.info.basic,video.publish',
    response_type: 'code',
    redirect_uri: redirectUri,
    state,
  })
  return `https://www.tiktok.com/v2/auth/authorize/?${q}`
}

export async function tiktokExchange(
  code: string,
  redirectUri: string,
): Promise<SocialResult<DiscoveredAccount & { refreshToken: string; expiresIn: number }>> {
  const key = process.env.TIKTOK_CLIENT_KEY
  const secret = process.env.TIKTOK_CLIENT_SECRET
  if (!key || !secret) return { ok: false, error: 'ربط تيك توك مش مضبوط على المنصة' }

  try {
    const res = await fetch(`${TIKTOK}/oauth/token/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: key,
        client_secret: secret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })

    const data = (await res.json()) as {
      access_token?: string
      refresh_token?: string
      expires_in?: number
      open_id?: string
      error_description?: string
    }

    if (!data.access_token || !data.open_id) {
      return { ok: false, error: data.error_description ?? 'مقدرناش نكمّل ربط تيك توك' }
    }

    const info = await fetchJson<{
      data?: { user?: { display_name?: string; avatar_url?: string } }
    }>(`${TIKTOK}/user/info/?fields=display_name,avatar_url`, {
      headers: { Authorization: `Bearer ${data.access_token}` },
    })

    /*
      قدرة النشر المباشر بتتفحص عند الاستعلام لا بتتفترض.

      التطبيق غير المدقَّق بيقدر يرفع للمسوّدات بس. الفرق ده لازم
      يبان للتاجر **قبل** ما يجدول — لا بعد ما يستنّى بوست ما نزلش.
    */
    const caps = await fetchJson<{ data?: { privacy_level_options?: string[] } }>(
      `${TIKTOK}/post/publish/creator_info/query/`,
      { method: 'POST', headers: { Authorization: `Bearer ${data.access_token}` } },
    )
    const canPublish = Boolean(caps?.data?.privacy_level_options?.length)

    return {
      ok: true,
      data: {
        platform: 'tiktok',
        externalId: data.open_id,
        name: info?.data?.user?.display_name ?? 'تيك توك',
        avatar: info?.data?.user?.avatar_url ?? null,
        accessToken: data.access_token,
        refreshToken: data.refresh_token ?? '',
        expiresIn: data.expires_in ?? 86_400,
        canPublish,
      },
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'مقدرناش نكمّل ربط تيك توك' }
  }
}

/* ══════════════════════════════════════════════════════════════
   الحفظ والقراءة
   ══════════════════════════════════════════════════════════════ */

/**
 * حفظ حساب — أو تحديث توكنه لو مربوط قبل كده.
 *
 * إعادة الربط بتحصل كتير (التوكن بيقع، التاجر بيغيّر باسورده).
 * الصف الجديد في كل مرة كان بيسيب حسابات ميتة في القايمة، والتاجر
 * يجدول على واحد منهم ويستنّى بوست ما بينزلش.
 */
export async function saveAccount(input: {
  storeId: string
  userId: string
  account: DiscoveredAccount
  refreshToken?: string | null
  expiresAt?: Date | null
  provider?: 'direct' | 'uploadpost'
  providerProfile?: string | null
}): Promise<void> {
  const values = {
    name: input.account.name,
    avatar: input.account.avatar,
    accessToken: encrypt(input.account.accessToken),
    refreshToken: input.refreshToken ? encrypt(input.refreshToken) : null,
    expiresAt: input.expiresAt ?? null,
    canPublish: input.account.canPublish,
    status: 'active' as const,
    lastError: null,
    provider: input.provider ?? ('direct' as const),
    providerProfile: input.providerProfile ?? null,
    updatedAt: new Date(),
  }

  await db
    .insert(socialAccounts)
    .values({
      storeId: input.storeId,
      platform: input.account.platform,
      externalId: input.account.externalId,
      connectedBy: input.userId,
      ...values,
    })
    .onConflictDoUpdate({
      target: [socialAccounts.storeId, socialAccounts.platform, socialAccounts.externalId],
      set: values,
    })
}

export type ConnectedAccount = {
  id: string
  platform: SocialPlatform
  name: string
  avatar: string | null
  canPublish: boolean
  provider: 'direct' | 'uploadpost'
  status: 'active' | 'expired' | 'revoked'
  lastError: string | null
  expiresAt: Date | null
}

/**
 * حسابات المتجر — **من غير التوكنات**.
 *
 * الشاشة ما تحتاجش التوكن، والقايمة دي بتتمرّر لمكوّن عميل. تمريره
 * كان بيبعت مفتاح النشر لمتصفح أي حد فاتح اللوحة.
 */
export async function listAccounts(storeId: string): Promise<ConnectedAccount[]> {
  return db
    .select({
      id: socialAccounts.id,
      platform: socialAccounts.platform,
      name: socialAccounts.name,
      avatar: socialAccounts.avatar,
      canPublish: socialAccounts.canPublish,
      provider: socialAccounts.provider,
      status: socialAccounts.status,
      lastError: socialAccounts.lastError,
      expiresAt: socialAccounts.expiresAt,
    })
    .from(socialAccounts)
    .where(eq(socialAccounts.storeId, storeId))
    .orderBy(socialAccounts.platform)
}

export async function disconnectAccount(storeId: string, id: string): Promise<void> {
  await db
    .delete(socialAccounts)
    .where(and(eq(socialAccounts.id, id), eq(socialAccounts.storeId, storeId)))
}

/* ══════════════════════════════════════════════════════════════
   النشر
   ══════════════════════════════════════════════════════════════ */

export type PublishOutcome = { accountId: string; ok: boolean; externalId?: string; error?: string }

/**
 * نشر بوست على حساب.
 *
 * ## كل حساب على حدة، والفشل ما بيوقّفش الباقي
 * البوست اللي نزل على فيسبوك وفشل على إنستجرام مش فاشلًا ولا
 * ناجحًا. الوقوف عند أول خطأ كان بيخلّي التاجر يعيد النشر فينزل
 * على فيسبوك مرتين.
 */
export async function publishToAccount(
  storeId: string,
  accountId: string,
  /**
   * الوسيط: صورة أو فيديو، واحد بس.
   *
   * `videoUrl` بيغلب لو الاتنين موجودين — البوست اللي فيه فيديو
   * هو فيديو، والصورة معاه بتبقى غلاف لا محتوى تاني. ونشر
   * الاتنين كان بيطلّع بوستين على نفس الصفحة.
   */
  post: { caption: string; hashtags: string[]; imageUrl?: string | null; videoUrl?: string | null },
): Promise<PublishOutcome> {
  const [acc] = await db
    .select()
    .from(socialAccounts)
    .where(and(eq(socialAccounts.id, accountId), eq(socialAccounts.storeId, storeId)))
    .limit(1)

  if (!acc) return { accountId, ok: false, error: 'الحساب مش موجود' }
  if (acc.status !== 'active') return { accountId, ok: false, error: 'الربط انتهى — اربط تاني' }

  /* الهاشتاجات آخر النص — كل المنصات بتقراها كده */
  const captionText = [post.caption, post.hashtags.join(' ')].filter(Boolean).join('\n\n')

  /*
    حساب الوسيط بيمشي في طريقه.

    الفحص هنا لا في المنادي: النشر بيتنادى من الجدول ومن الزرار
    ومن إعادة المحاولة — وتكرار الشرط في التلاتة كان بيخلّي أول
    واحد يتنسى ينشر بالطريق الغلط.
  */
  if (acc.provider === 'uploadpost') {
    const video = post.videoUrl?.trim() || null
    const image = post.imageUrl?.trim() || null
    const media = video ?? image
    if (!media) return { accountId, ok: false, error: 'البوست من غير صورة ولا فيديو' }

    const res = await publishViaProvider({
      storeId,
      platform: acc.platform,
      caption: captionText,
      mediaUrl: media,
      isVideo: Boolean(video),
    })

    if (!res.ok) {
      await markError(acc.id, res.error)
      return { accountId, ok: false, error: res.error }
    }
    return { accountId, ok: true, externalId: res.data }
  }

  const token = safeDecrypt(acc.accessToken)
  if (!token) return { accountId, ok: false, error: 'التوكن مقروش — اربط تاني' }

  const text = captionText

  try {
    const video = post.videoUrl?.trim() || null
    const image = post.imageUrl?.trim() || null

    if (!video && !image) return { accountId, ok: false, error: 'البوست من غير صورة ولا فيديو' }

    const res = video
      ? acc.platform === 'facebook'
        ? await publishFacebookVideo(acc.externalId, token, text, video)
        : acc.platform === 'instagram'
          ? await publishInstagramReel(acc.externalId, token, text, video)
          : await publishTiktokVideo(token, text, video, acc.canPublish)
      : acc.platform === 'facebook'
        ? await publishFacebook(acc.externalId, token, text, image!)
        : acc.platform === 'instagram'
          ? await publishInstagram(acc.externalId, token, text, image!)
          : await publishTiktok(token, text, image!, acc.canPublish)

    if (!res.ok) {
      await markError(acc.id, res.error)
      return { accountId, ok: false, error: res.error }
    }

    return { accountId, ok: true, externalId: res.data }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'فشل النشر'
    await markError(acc.id, msg)
    return { accountId, ok: false, error: msg }
  }
}

/** صفحة فيسبوك — صورة بتعليق */
async function publishFacebook(
  pageId: string,
  token: string,
  caption: string,
  imageUrl: string,
): Promise<SocialResult<string>> {
  const res = await fetch(`${GRAPH}/${pageId}/photos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: imageUrl, caption, access_token: token }),
  })

  const data = (await res.json()) as { id?: string; post_id?: string; error?: { message?: string } }
  if (!res.ok || data.error) {
    return { ok: false, error: data.error?.message ?? 'فيسبوك رفض النشر' }
  }
  return { ok: true, data: data.post_id ?? data.id ?? '' }
}

/**
 * إنستجرام — خطوتين إلزاميتين.
 *
 * الرفع بيعمل «حاوية» والنشر بياخد معرّفها. النداء الواحد مش
 * موجود عندهم أصلًا، وإنستجرام بيرفض الحاوية اللي اتنشرت قبل كده
 * — فمفيش خطر تكرار من إعادة المحاولة.
 */
async function publishInstagram(
  igUserId: string,
  token: string,
  caption: string,
  imageUrl: string,
): Promise<SocialResult<string>> {
  const created = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
  })

  const cData = (await created.json()) as { id?: string; error?: { message?: string } }
  if (!created.ok || !cData.id) {
    return { ok: false, error: cData.error?.message ?? 'إنستجرام رفض الصورة' }
  }

  const published = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: cData.id, access_token: token }),
  })

  const pData = (await published.json()) as { id?: string; error?: { message?: string } }
  if (!published.ok || !pData.id) {
    return { ok: false, error: pData.error?.message ?? 'إنستجرام رفض النشر' }
  }
  return { ok: true, data: pData.id }
}

/**
 * تيك توك — بوست صور.
 *
 * ## النشر المباشر ولا المسوّدة
 * `DIRECT_POST` بينزل على طول ومحتاج تطبيقنا يكون متدقَّقًا.
 * و`MEDIA_UPLOAD` بيحطّها في مسوّدات التاجر وهو بيدوس نشر من
 * التطبيق. بنختار حسب اللي اتقاس وقت الربط — لأن النشر المباشر
 * على تطبيق مش متدقَّق بيرجع خطأ مالوش علاقة بالسبب.
 */
async function publishTiktok(
  token: string,
  caption: string,
  imageUrl: string,
  canPublish: boolean,
): Promise<SocialResult<string>> {
  const res = await fetch(`${TIKTOK}/post/publish/content/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      post_mode: canPublish ? 'DIRECT_POST' : 'MEDIA_UPLOAD',
      media_type: 'PHOTO',
      post_info: {
        title: caption.slice(0, 90),
        description: caption.slice(0, 4000),
        privacy_level: canPublish ? 'PUBLIC_TO_EVERYONE' : undefined,
      },
      source_info: {
        source: 'PULL_FROM_URL',
        photo_cover_index: 0,
        photo_images: [imageUrl],
      },
    }),
  })

  const data = (await res.json()) as {
    data?: { publish_id?: string }
    error?: { code?: string; message?: string }
  }

  if (data.error && data.error.code !== 'ok') {
    return { ok: false, error: data.error.message ?? 'تيك توك رفض النشر' }
  }
  if (!data.data?.publish_id) return { ok: false, error: 'تيك توك ما رجّعش معرّف النشر' }

  return { ok: true, data: data.data.publish_id }
}

/* ══════════════════════════════════════════════════════════════
   الفيديو
   ══════════════════════════════════════════════════════════════ */

/** فيديو على صفحة فيسبوك */
async function publishFacebookVideo(
  pageId: string,
  token: string,
  description: string,
  videoUrl: string,
): Promise<SocialResult<string>> {
  /*
    `graph-video` لا `graph`.

    رفع الفيديو عند ميتا على نطاق تاني، والنطاق العادي بيرد بخطأ
    مالوش علاقة بالسبب.
  */
  const res = await fetch(`https://graph-video.facebook.com/v21.0/${pageId}/videos`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ file_url: videoUrl, description, access_token: token }),
  })

  const data = (await res.json()) as { id?: string; error?: { message?: string } }
  if (!res.ok || data.error) {
    return { ok: false, error: data.error?.message ?? 'فيسبوك رفض الفيديو' }
  }
  return { ok: true, data: data.id ?? '' }
}

/**
 * ريلز إنستجرام — تلات خطوات.
 *
 * ## والانتظار إلزامي بين الرفع والنشر
 * إنستجرام بيعالج الفيديو بعد الرفع، والنشر على حاوية لسه بتتعالج
 * بيترفض بـ«Media not ready». مفيش ويب هوك للحالة دي — السؤال هو
 * الطريقة الوحيدة، والحدّ الأقصى ٩٠ ثانية عشان الدالة ما تموتش
 * وهي مستنّية.
 */
async function publishInstagramReel(
  igUserId: string,
  token: string,
  caption: string,
  videoUrl: string,
): Promise<SocialResult<string>> {
  const created = await fetch(`${GRAPH}/${igUserId}/media`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      media_type: 'REELS',
      video_url: videoUrl,
      caption,
      /* بيبان في التايم لاين كمان لا في تبويب الريلز وحده */
      share_to_feed: true,
      access_token: token,
    }),
  })

  const cData = (await created.json()) as { id?: string; error?: { message?: string } }
  if (!created.ok || !cData.id) {
    return { ok: false, error: cData.error?.message ?? 'إنستجرام رفض الفيديو' }
  }

  const ready = await waitForContainer(cData.id, token)
  if (!ready.ok) return ready

  const published = await fetch(`${GRAPH}/${igUserId}/media_publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: cData.id, access_token: token }),
  })

  const pData = (await published.json()) as { id?: string; error?: { message?: string } }
  if (!published.ok || !pData.id) {
    return { ok: false, error: pData.error?.message ?? 'إنستجرام رفض النشر' }
  }
  return { ok: true, data: pData.id }
}

/** انتظار معالجة الحاوية — بيسأل كل خمس ثواني */
async function waitForContainer(containerId: string, token: string): Promise<SocialResult<string>> {
  for (let i = 0; i < 18; i++) {
    await new Promise((r) => setTimeout(r, 5000))

    const res = await fetchJson<{ status_code?: string; status?: string }>(
      `${GRAPH}/${containerId}?fields=status_code,status&access_token=${encodeURIComponent(token)}`,
    )

    if (res?.status_code === 'FINISHED') return { ok: true, data: containerId }
    if (res?.status_code === 'ERROR') {
      return { ok: false, error: res.status ?? 'إنستجرام فشل في معالجة الفيديو' }
    }
  }

  return {
    ok: false,
    error: 'إنستجرام أخد وقت أطول من المتوقّع في معالجة الفيديو. جرّب تنشره تاني بعد شوية.',
  }
}

/**
 * فيديو تيك توك — وده المسار الطبيعي عندهم.
 *
 * تيك توك أصلًا منصة فيديو، فالمسار ده أبسط من بوست الصور: نوع
 * الوسيط `VIDEO` والمصدر رابط، وخلاص.
 */
async function publishTiktokVideo(
  token: string,
  caption: string,
  videoUrl: string,
  canPublish: boolean,
): Promise<SocialResult<string>> {
  const res = await fetch(`${TIKTOK}/post/publish/video/init/`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      post_info: canPublish
        ? { title: caption.slice(0, 2200), privacy_level: 'PUBLIC_TO_EVERYONE' }
        : { title: caption.slice(0, 2200) },
      source_info: { source: 'PULL_FROM_URL', video_url: videoUrl },
    }),
  })

  const data = (await res.json()) as {
    data?: { publish_id?: string }
    error?: { code?: string; message?: string }
  }

  if (data.error && data.error.code !== 'ok') {
    return { ok: false, error: data.error.message ?? 'تيك توك رفض الفيديو' }
  }
  if (!data.data?.publish_id) return { ok: false, error: 'تيك توك ما رجّعش معرّف النشر' }

  return { ok: true, data: data.data.publish_id }
}

/* ══════════════════════════════════════════════════════════════
   أدوات
   ══════════════════════════════════════════════════════════════ */

/**
 * خطأ ميتا بالعربي — والأشهر بيتشرح.
 *
 * ## «التطبيق في وضع التطوير» هو أكتر خطأ هيحصل في البداية
 * التطبيق قبل المراجعة بينشر لحد ٢٥ حساب ليهم دور فيه بس. التاجر
 * اللي مش متضاف بيشوف رسالة إنجليزية عن «development mode»
 * ومالهاش معنى عنده — فبيفتكر إن المنصة بايظة ويسيب الميزة.
 *
 * والرسالة هنا بتقوله يعمل إيه: يكلّم الدعم عشان يتضاف. ده الفرق
 * بين تاجر بيستنّى دعوة وتاجر بيسيب.
 */
function friendlyMetaError(raw: string | undefined): string {
  if (!raw) return 'مقدرناش نكمّل الربط. جرّب تاني.'

  if (/development mode|not available to the public|role/i.test(raw)) {
    return (
      'الربط لسه متاح لعدد محدود من التجّار وإنت لسه مش فيهم. ' +
      'كلّم الدعم وهنضيفك — أو انشر من موبايلك دلوقتي من صفحة «البوستات».'
    )
  }
  if (/redirect|uri/i.test(raw)) {
    return 'فيه إعداد ناقص في الربط عندنا. بلّغ الدعم وهنظبّطه.'
  }
  if (/permission|scope/i.test(raw)) {
    return 'مفيش صلاحية كافية على الصفحة. اتأكد إنك أدمن عليها وجرّب تاني.'
  }

  return `فيسبوك ردّ: ${raw}`
}

async function markError(accountId: string, error: string): Promise<void> {
  /*
    الخطأ بيتسجّل على الحساب لا في السجل وبس.

    التاجر بيفتح شاشة الحسابات لما بوست ما ينزلش، والسبب لازم يبقى
    جنب الحساب — «الربط انتهى» بيقول له يعمل إيه، و«فشل النشر»
    بيخلّيه يسأل.
  */
  const expired = /expired|invalid|OAuth|session/i.test(error)
  await db
    .update(socialAccounts)
    .set({
      lastError: error.slice(0, 300),
      status: expired ? 'expired' : 'active',
      updatedAt: new Date(),
    })
    .where(eq(socialAccounts.id, accountId))
    .catch(() => {})
}

/** التوكن المتخزّن بمفتاح قديم بيرجّع فاضي بدل ما يرمي */
function safeDecrypt(value: string): string | null {
  try {
    return decrypt(value)
  } catch {
    return null
  }
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(url, init)
    return (await res.json()) as T
  } catch {
    return null
  }
}
