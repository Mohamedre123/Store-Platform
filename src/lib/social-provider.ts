import 'server-only'
import type { SocialPlatform } from './studio-meta'

/**
 * النشر عن طريق وسيط.
 *
 * ## المشكلة اللي بيحلّها
 * ميتا وتيك توك بيطلبوا: تطبيق مطوّر، وتأكيد ملكية دومين، وتوثيق
 * نشاط تجاري بسجل ضريبي، ومراجعة بفيديو توضيحي. ده أسابيع من
 * الشغل الإداري **قبل** ما أول بوست ينزل — والتاجر اللي مستنّي
 * الميزة بيسيبها.
 *
 * والوسيط عنده الموافقات دي جاهزة أصلًا. بنبعتله الصورة والكلام
 * وهو بينشر. **نفس النتيجة بالظبط عند عميل التاجر** — بوست على
 * صفحته باسمه.
 *
 * ## وده مش بديل دايم بالضرورة
 * `social_accounts.provider` بيخلّي الطريقين يعيشوا جنب بعض: اللي
 * اتربط بتطبيقنا مباشرةً بيفضل شغّال، واللي اتربط بالوسيط كمان.
 * فلما موافقتنا تخلص، مفيش حاجة بتتكسر — التجّار الجداد بس بيربطوا
 * مباشرةً.
 *
 * ## واللي مش بنعمله
 * مفيش أي أداة بتشتغل بباسورد التاجر (سكرابينج). دي بتوقّع حسابه
 * في الحظر، ومعناها إننا بنخزّن باسووردات التجّار عندنا. الوسيط
 * الشرعي أغلى بشوية وبيشتغل من غير ما حد يخسر حسابه.
 */

const BASE = 'https://api.upload-post.com'

export type ProviderResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function providerConfigured(): boolean {
  return Boolean(process.env.UPLOAD_POST_API_KEY)
}

function headers(): Record<string, string> {
  return { Authorization: `Apikey ${process.env.UPLOAD_POST_API_KEY ?? ''}` }
}

/**
 * اسم ملف المتجر عند الوسيط.
 *
 * ## مشتقّ من المعرّف لا مخزَّن
 * لو خزّنّاه، المتجر اللي اتعمل له ملف والصف اتمسح بغلط بيفضل عنده
 * ملف يتيم عند الوسيط ومحدش يعرف بتاع مين. والاشتقاق بيخلّي نفس
 * المتجر يدّي نفس الاسم دايمًا.
 *
 * والشرطات بتتشال: الوسيط بيقبل حروف وأرقام وشرطة سفلية بس.
 */
export function profileFor(storeId: string): string {
  return 'zw_' + storeId.replace(/-/g, '').slice(0, 24)
}

/** الملف موجود؟ اعمله. — بيتنادى قبل الربط وقبل النشر */
export async function ensureProfile(storeId: string): Promise<ProviderResult<string>> {
  const username = profileFor(storeId)

  try {
    const res = await fetch(`${BASE}/api/uploadposts/users`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })

    /*
      الملف الموجود بيرجّع خطأ، وده نجاح مش فشل.

      الرمي هنا كان بيخلّي التاجر مش قادر يربط تاني بعد أول مرة —
      وإعادة الربط بتحصل كتير (التوكن بيقع، بيغيّر صفحته).
    */
    if (res.ok || res.status === 409) return { ok: true, data: username }

    const body = await res.text()
    if (/exist/i.test(body)) return { ok: true, data: username }

    return { ok: false, error: friendly(res.status, body) }
  } catch (e) {
    return { ok: false, error: netError(e) }
  }
}

/**
 * رابط ربط منصة — بيرجّع عنوان شاشة الموافقة.
 *
 * التاجر بيروح لشاشة فيسبوك أو تيك توك الحقيقية، بس التطبيق تطبيق
 * الوسيط — فالموافقة بتعدّي من غير ما نستنّى مراجعة.
 */
export async function connectUrl(
  storeId: string,
  platform: SocialPlatform,
  redirectUrl: string,
): Promise<ProviderResult<string>> {
  const profile = await ensureProfile(storeId)
  if (!profile.ok) return profile

  try {
    const res = await fetch(`${BASE}/api/uploadposts/oauth/${platform}/start`, {
      method: 'POST',
      headers: { ...headers(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile: profile.data, redirect_url: redirectUrl }),
    })

    const data = (await res.json().catch(() => null)) as {
      authorize_url?: string
      url?: string
      error?: string
    } | null

    const url = data?.authorize_url ?? data?.url
    if (!res.ok || !url) {
      return { ok: false, error: data?.error ?? friendly(res.status, '') }
    }

    return { ok: true, data: url }
  } catch (e) {
    return { ok: false, error: netError(e) }
  }
}

export type ProviderAccount = {
  platform: SocialPlatform
  externalId: string
  name: string
  avatar: string | null
}

/**
 * الحسابات اللي التاجر ربطها عند الوسيط.
 *
 * بتتنادى بعد رجوعه من شاشة الموافقة: بنقرا اللي اتربط فعلًا بدل
 * ما نصدّق الرابط اللي رجع بيه. الرابط بيقول «تمام» حتى لو التاجر
 * قفل الشاشة في نصّها.
 */
export async function listConnected(storeId: string): Promise<ProviderResult<ProviderAccount[]>> {
  const username = profileFor(storeId)

  try {
    const res = await fetch(`${BASE}/api/uploadposts/users`, { headers: headers() })
    if (!res.ok) return { ok: false, error: friendly(res.status, await res.text()) }

    const data = (await res.json()) as {
      profiles?: Array<{
        username?: string
        social_accounts?: Record<string, unknown>
      }>
    }

    const mine = data.profiles?.find((p) => p.username === username)
    if (!mine) return { ok: true, data: [] }

    const out: ProviderAccount[] = []

    /*
      شكل الرد بيختلف بين المنصات.

      بعضها بيرجّع كائن فيه الاسم والصورة، وبعضها بيرجّع نصًّا
      باسم المستخدم بس، والمقفول بيرجّع فاضي. القراءة المرنة
      بتخلّي منصة جديدة عندهم تشتغل من غير تعديل عندنا.
    */
    for (const [key, value] of Object.entries(mine.social_accounts ?? {})) {
      const platform = key.toLowerCase()
      if (!isSupported(platform)) continue
      if (!value) continue

      const obj = typeof value === 'object' ? (value as Record<string, unknown>) : null
      const name =
        (typeof value === 'string' && value) ||
        (typeof obj?.username === 'string' && obj.username) ||
        (typeof obj?.display_name === 'string' && obj.display_name) ||
        (typeof obj?.name === 'string' && obj.name) ||
        platform

      const id =
        (typeof obj?.id === 'string' && obj.id) ||
        (typeof obj?.social_id === 'string' && obj.social_id) ||
        /* مفيش معرّف؟ المنصة نفسها كافية — الملف واحد لكل متجر */
        platform

      out.push({
        platform,
        externalId: id,
        name: String(name),
        avatar: typeof obj?.avatar_url === 'string' ? obj.avatar_url : null,
      })
    }

    return { ok: true, data: out }
  } catch (e) {
    return { ok: false, error: netError(e) }
  }
}

function isSupported(p: string): p is SocialPlatform {
  return p === 'facebook' || p === 'instagram' || p === 'tiktok'
}

/**
 * النشر.
 *
 * ## الملف بيتبعت خام لا كرابط
 * الوسيط بياخد `multipart/form-data`. تمرير رابط تخزيننا كان
 * هيخلّيه يحتاج يوصل له — وده بيقع مع أي إعداد خصوصية على البكت.
 * والتحميل عندنا وإعادة الرفع أضمن، والملف صغير أصلًا.
 */
export async function publishViaProvider(input: {
  storeId: string
  platform: SocialPlatform
  caption: string
  mediaUrl: string
  isVideo: boolean
}): Promise<ProviderResult<string>> {
  try {
    const file = await fetch(input.mediaUrl)
    if (!file.ok) return { ok: false, error: 'مقدرناش نجيب الملف من التخزين' }

    const blob = await file.blob()
    const name = input.isVideo ? 'post.mp4' : 'post.png'

    const form = new FormData()
    form.append('file', blob, name)
    form.append('profile', profileFor(input.storeId))
    form.append('platforms', input.platform)
    form.append('caption', input.caption)

    const res = await fetch(`${BASE}/api/upload`, {
      method: 'POST',
      headers: headers(),
      body: form,
    })

    const data = (await res.json().catch(() => null)) as {
      success?: boolean
      request_id?: string
      results?: Record<string, { success?: boolean; error?: string }>
      error?: string
    } | null

    if (!res.ok || data?.success === false) {
      /*
        خطأ المنصة نفسها أدقّ من خطأ الوسيط.

        «فشل الرفع» ما بتقولش للتاجر يعمل إيه، و«حسابك مش أعمال»
        بتقوله. فبندوّر على سبب المنصة الأول.
      */
      const perPlatform = data?.results?.[input.platform]?.error
      return { ok: false, error: perPlatform ?? data?.error ?? friendly(res.status, '') }
    }

    return { ok: true, data: data?.request_id ?? '' }
  } catch (e) {
    return { ok: false, error: netError(e) }
  }
}

/* ══════════════════════════════════════════════════════════════
   الأخطاء
   ══════════════════════════════════════════════════════════════ */

/**
 * رسالة مفهومة بدل رقم.
 *
 * «٤٢٩» ما بتقولش للتاجر يعمل إيه، و«حصّتك خلصت الشهر ده» بتقوله.
 */
function friendly(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'مفتاح خدمة النشر مش مضبوط على المنصة. بلّغ الدعم.'
  }
  if (status === 402 || /quota|limit|plan/i.test(body)) {
    return 'حصّة النشر خلصت الشهر ده. بلّغ الدعم عشان نرفعها.'
  }
  if (status === 429) return 'فيه ضغط على النشر دلوقتي. جرّب بعد شوية.'

  const msg = body.match(/"(?:error|message|detail)"\s*:\s*"([^"]{5,200})"/)?.[1]
  return msg ? `خدمة النشر ردّت: ${msg}` : `خدمة النشر ردّت بخطأ ${status}`
}

function netError(e: unknown): string {
  return e instanceof Error ? `مقدرناش نوصل لخدمة النشر: ${e.message}` : 'مقدرناش نوصل لخدمة النشر'
}
