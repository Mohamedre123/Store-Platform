import 'server-only'
import type { SocialPlatform } from './studio-meta'

/**
 * النشر عن طريق وسيط.
 *
 * ## المشكلة اللي بيحلّها
 * ميتا وتيك توك بيطلبوا: تطبيق مطوّر، وتأكيد ملكية دومين، وتوثيق
 * نشاط تجاري بسجل ضريبي، ومراجعة بفيديو توضيحي. ده أسابيع من
 * الشغل الإداري **قبل** ما أول بوست ينزل.
 *
 * والوسيط عنده الموافقات دي جاهزة. بنبعتله الصورة والكلام وهو
 * بينشر. **نفس النتيجة بالظبط عند عميل التاجر** — بوست على صفحته
 * باسمه.
 *
 * ## وده مش بديل دايم بالضرورة
 * `social_accounts.provider` بيخلّي الطريقين يعيشوا جنب بعض: اللي
 * اتربط بتطبيقنا مباشرةً بيفضل شغّال، واللي اتربط بالوسيط كمان.
 * فلما موافقتنا تخلص، مفيش حاجة بتتكسر.
 *
 * ## واللي مش بنعمله
 * مفيش أي أداة بتشتغل بباسورد التاجر (سكرابينج). دي بتوقّع حسابه
 * في الحظر، ومعناها إننا بنخزّن باسووردات التجّار عندنا. الوسيط
 * الشرعي بيشتغل من غير ما حد يخسر حسابه.
 *
 * ## العقد ده اتقاس مش اتفترض
 * أسماء الحقول (`user` و`platform[]` و`title` و`photos[]`) اتجرّبت
 * على الـAPI الحقيقي بمفتاح شغّال. التخمين الأول كان غلط في أربع
 * أسماء من خمسة — والغلط ده كان هيبان «فشل النشر» من غير سبب.
 */

const BASE = 'https://api.upload-post.com'

export type ProviderResult<T> = { ok: true; data: T } | { ok: false; error: string }

export function providerConfigured(): boolean {
  return Boolean(process.env.UPLOAD_POST_API_KEY)
}

function auth(): Record<string, string> {
  return { Authorization: `Apikey ${process.env.UPLOAD_POST_API_KEY ?? ''}` }
}

/**
 * اسم ملف المتجر عند الوسيط.
 *
 * ## مشتقّ من المعرّف لا مخزَّن
 * لو خزّنّاه، المتجر اللي اتمسح صفّه بغلط بيسيب ملفًا يتيمًا عند
 * الوسيط ومحدش يعرف بتاع مين. والاشتقاق بيخلّي نفس المتجر يدّي
 * نفس الاسم دايمًا.
 */
export function profileFor(storeId: string): string {
  return 'zw_' + storeId.replace(/-/g, '').slice(0, 24)
}

/** الملف موجود؟ اعمله */
export async function ensureProfile(storeId: string): Promise<ProviderResult<string>> {
  const username = profileFor(storeId)

  try {
    const res = await fetch(`${BASE}/api/uploadposts/users`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    })

    if (res.ok) return { ok: true, data: username }

    const body = await res.text()

    /*
      الملف الموجود نجاح مش فشل.

      إعادة الربط بتحصل كتير (التوكن بيقع، التاجر بيغيّر صفحته)،
      والرفض هنا كان بيمنعه من الربط تاني بعد أول مرة.
    */
    if (res.status === 409 || /exist|already/i.test(body)) {
      return { ok: true, data: username }
    }

    /*
      حدّ الملفات = حدّ التجّار.

      الباقة المجانية بتدّي ملفين. الرسالة لازم تقول ده صراحةً
      للإدارة — «فشل الربط» كانت هتخلّيهم يدوّروا في الكود والمشكلة
      في الاشتراك.
    */
    if (/PROFILE_LIMIT_REACHED/i.test(body)) {
      const limit = body.match(/"profile_limit"\s*:\s*(\d+)/)?.[1] ?? '؟'
      return {
        ok: false,
        error: `وصلنا لحد ${limit} تاجر على باقة خدمة النشر الحالية. بلّغ الدعم عشان نرفعها.`,
      }
    }

    return { ok: false, error: friendly(res.status, body) }
  } catch (e) {
    return { ok: false, error: netError(e) }
  }
}

/**
 * صفحة ربط الحسابات.
 *
 * الوسيط بيدّي صفحة مستضافة عنده، والتاجر بيربط منها فيسبوك
 * وإنستجرام وغيرهم — كلهم من مكان واحد. الرابط عمره ٤٨ ساعة.
 */
export async function connectUrl(storeId: string): Promise<ProviderResult<string>> {
  const profile = await ensureProfile(storeId)
  if (!profile.ok) return profile

  try {
    const res = await fetch(`${BASE}/api/uploadposts/users/generate-jwt`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: profile.data }),
    })

    const data = (await res.json().catch(() => null)) as {
      access_url?: string
      message?: string
    } | null

    if (!res.ok || !data?.access_url) {
      return { ok: false, error: data?.message ?? friendly(res.status, '') }
    }

    return { ok: true, data: data.access_url }
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
 * الحسابات اللي اتربطت فعلًا.
 *
 * ## بنقرا الحالة بدل ما نصدّق الرجوع
 * التاجر بيربط في صفحة الوسيط ويرجع بإيده — مفيش رابط بيقول لنا
 * نجح ولا لأ. والقراءة هي الطريقة الوحيدة المضمونة.
 *
 * ## والنص الفاضي معناه «مش مربوط»
 * الرد بيرجّع `{"tiktok": ""}` للمنصة المدعومة وغير المربوطة.
 * حفظها كحساب كان هيخلّي التاجر يختارها وجهة ويستنّى بوست مش
 * هينزل.
 */
export async function listConnected(storeId: string): Promise<ProviderResult<ProviderAccount[]>> {
  const username = profileFor(storeId)

  try {
    const res = await fetch(`${BASE}/api/uploadposts/users`, { headers: auth() })
    if (!res.ok) return { ok: false, error: friendly(res.status, await res.text()) }

    const data = (await res.json()) as {
      profiles?: Array<{ username?: string; social_accounts?: Record<string, unknown> }>
    }

    const mine = data.profiles?.find((p) => p.username === username)
    if (!mine) return { ok: true, data: [] }

    const out: ProviderAccount[] = []

    for (const [key, value] of Object.entries(mine.social_accounts ?? {})) {
      const platform = key.toLowerCase()
      if (!isSupported(platform)) continue

      /* الفاضي = مدعوم بس مش مربوط */
      if (!value || (typeof value === 'string' && !value.trim())) continue

      const obj = typeof value === 'object' ? (value as Record<string, unknown>) : null
      const name =
        (typeof value === 'string' && value) ||
        (typeof obj?.username === 'string' && obj.username) ||
        (typeof obj?.display_name === 'string' && obj.display_name) ||
        platform

      out.push({
        platform,
        externalId:
          (typeof obj?.id === 'string' && obj.id) ||
          (typeof obj?.social_id === 'string' && obj.social_id) ||
          /* مفيش معرّف؟ المنصة كافية — الملف واحد لكل متجر */
          platform,
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
 * ## الصور والفيديو ليهم مسارات مختلفة
 * `/api/upload_photos` بياخد `photos[]`، و`/api/upload` بياخد
 * `video`. المسار الواحد كان بيرفض النوع التاني برسالة عن حقل
 * ناقص مالهاش علاقة بالسبب الحقيقي.
 *
 * ## والملف بيتبعت خام
 * الوسيط بياخد `multipart/form-data` زي ما مثاله بيقول
 * (`video=@ملف`). التحميل من تخزيننا وإعادة الرفع أضمن من إننا
 * نديله رابطًا محتاج يوصل له.
 */
export async function publishViaProvider(input: {
  storeId: string
  platform: SocialPlatform
  caption: string
  /**
   * الصور بترتيبها — واحدة يعني بوست عادي، وأكتر يعني كاروسيل.
   *
   * الترتيب هو اللي بينشر: أول واحدة هي الغلاف اللي بيظهر في
   * التايم لاين، والباقي بيتسحب. عكسه بيخلّي الحكاية مالهاش معنى.
   */
  mediaUrls: string[]
  isVideo: boolean
}): Promise<ProviderResult<string>> {
  try {
    const urls = input.mediaUrls.filter(Boolean)
    if (urls.length === 0) return { ok: false, error: 'البوست من غير صورة ولا فيديو' }

    const form = new FormData()
    form.append('user', profileFor(input.storeId))
    form.append('platform[]', input.platform)

    /*
      `title` هو نص البوست عندهم لا عنوان منفصل.

      الاسم مضلّل، لكنه اللي بيظهر كوصف البوست على كل المنصات —
      وبعت الكلام في `caption` كان بيخلّي البوست ينزل من غير نص.
    */
    form.append('title', input.caption)

    const endpoint = input.isVideo ? '/api/upload' : '/api/upload_photos'

    if (input.isVideo) {
      const file = await fetch(urls[0])
      if (!file.ok) return { ok: false, error: 'مقدرناش نجيب الفيديو من التخزين' }
      form.append('video', await file.blob(), 'post.mp4')
    } else {
      /*
        الشرايح بترتيبها، واحدة ورا التانية في نفس الحقل.

        `photos[]` بيتكرر — ودي طريقة `multipart` في تمرير قايمة.
        والترتيب هو ترتيب الإضافة.
      */
      for (let i = 0; i < urls.length; i++) {
        const file = await fetch(urls[i])
        if (!file.ok) return { ok: false, error: 'مقدرناش نجيب الصورة ' + (i + 1) }
        form.append('photos[]', await file.blob(), 'slide' + (i + 1) + '.png')
      }
    }

    const res = await fetch(BASE + endpoint, { method: 'POST', headers: auth(), body: form })

    const data = (await res.json().catch(() => null)) as {
      success?: boolean
      request_id?: string
      invalid_platforms?: Record<string, string>
      results?: Record<string, { success?: boolean; error?: string }>
      message?: string
    } | null

    if (!res.ok || data?.success === false) {
      /*
        سبب المنصة نفسها أدقّ من سبب الوسيط.

        «فشل النشر» ما بتقولش للتاجر يعمل إيه، و«الملف مالوش حساب
        إنستجرام» بتقوله. فبندوّر على السبب المفصّل الأول.
      */
      const reason =
        data?.invalid_platforms?.[input.platform] ??
        data?.results?.[input.platform]?.error ??
        data?.message

      return { ok: false, error: translate(reason) ?? friendly(res.status, '') }
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
 * الأخطاء الشائعة بالعربي.
 *
 * الوسيط بيرد بالإنجليزي، والتاجر المصري بيقرا رسالة مالهاش معنى
 * عنده فبيفتكر المنصة بايظة. والترجمة هنا لأشهرهم بس — الباقي
 * بيعدّي زي ما هو أحسن من «حصل خطأ».
 */
function translate(raw: string | undefined): string | null {
  if (!raw) return null

  if (/no .* account configured|not configured/i.test(raw)) {
    return 'الحساب ده مش مربوط. اربطه من «حسابات السوشيال» وجرّب تاني.'
  }
  if (/business|professional/i.test(raw)) {
    return 'حساب إنستجرام لازم يكون «أعمال» ومربوط بصفحة فيسبوك.'
  }
  if (/quota|limit|plan/i.test(raw)) {
    return 'حصّة النشر خلصت. بلّغ الدعم عشان نرفعها.'
  }
  if (/expired|reconnect|token/i.test(raw)) {
    return 'الربط انتهى. افصل الحساب واربطه تاني.'
  }

  return raw
}

function friendly(status: number, body: string): string {
  if (status === 401 || status === 403) {
    return 'مفتاح خدمة النشر مش مضبوط على المنصة. بلّغ الدعم.'
  }
  if (status === 402 || /quota|limit|plan/i.test(body)) {
    return 'حصّة النشر خلصت. بلّغ الدعم عشان نرفعها.'
  }
  if (status === 429) return 'فيه ضغط على النشر دلوقتي. جرّب بعد شوية.'

  const msg = body.match(/"(?:message|error|detail)"\s*:\s*"([^"]{5,200})"/)?.[1]
  return msg ? `خدمة النشر ردّت: ${msg}` : `خدمة النشر ردّت بخطأ ${status}`
}

function netError(e: unknown): string {
  return e instanceof Error ? `مقدرناش نوصل لخدمة النشر: ${e.message}` : 'مقدرناش نوصل لخدمة النشر'
}
