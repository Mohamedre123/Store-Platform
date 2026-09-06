import 'server-only'
import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { storeEvents, storePlugins } from '@/db/schema'
import { decryptJson } from '@/lib/crypto'

/**
 * أحداث التحويل من الخادم — Meta Conversions API وTikTok Events API.
 *
 * ## المشكلة اللي الملف ده بيحلّها — وهي كانت عطلًا لا نقصًا
 * المنصة كانت بتركّب بكسل المتصفح وبيبعت `PageView` **وبس**. مفيش
 * حدث `Purchase` كان بيخرج من أي مكان: لا من المتصفح ولا من الخادم.
 * يعني كل تاجر بيدفع في إعلانات ميتا كان بيشوف زيارات بلا مبيعات،
 * والخوارزمية بتحسّن على «اللي بيفتح» لا «اللي بيشتري» — وده بيحرق
 * الميزانية على أسوأ جمهور ممكن.
 *
 * ## وليه من الخادم لا من المتصفح وحده
 * مانع الإعلانات وiOS بيوقّفوا بكسل المتصفح على نسبة كبيرة من
 * الزوار. الحدث من الخادم بيعدّي دايمًا لأنه مش في متصفح العميل
 * أصلًا. والاتنين بيتبعتوا بنفس `event_id` فميتا بتشيل المكرّر —
 * من غير المعرّف ده، الطلب الواحد بيتحسب بيعتين والتاجر بيبني
 * قراراته على ضِعف الحقيقة.
 *
 * ## ومفاتيح المطابقة متجزّأة بالضرورة
 * ميتا بتطلب البريد والتليفون والاسم كـSHA-256، وبترفض أي حاجة
 * غير متجزّأة. التجزئة هنا مش «تأمين زيادة» — هي شرط الواجهة، وهي
 * كمان اللي بتخلّي بيانات عميل التاجر ما تخرجش من عندنا نصًّا.
 *
 * ## وفشل الإرسال ما بيوقّعش الطلب أبدًا
 * نفس قاعدة المزوّدين في PLAN: الطلب اتعمل والعميل دفع. حدث إعلاني
 * ما وصلش خسارة قياس، وطلب بيقع عشان API إعلانات واقع خسارة فلوس.
 */

/**
 * إعداد إضافة واحدة — العلني والسرّي مع بعض.
 *
 * الأسرار بتتخزّن مشفّرة في `store_plugins.secrets` زي كل مفاتيح
 * المزوّدين، والفكّ هنا لأن التوكن بيتبعت من الخادم وحده. لو
 * قرينا العلني بس، الشاشة كانت هتقول «مربوط» والإرسال يفضل
 * مقفول — وده أسوأ من «مش مربوط» لأنه بيسكّت التاجر.
 */
async function pluginConfig(
  storeId: string,
  slug: string,
): Promise<{ config: Record<string, unknown>; secrets: Record<string, unknown> } | null> {
  const [row] = await db
    .select({
      enabled: storePlugins.enabled,
      config: storePlugins.config,
      secrets: storePlugins.secrets,
    })
    .from(storePlugins)
    .where(and(eq(storePlugins.storeId, storeId), eq(storePlugins.pluginSlug, slug)))
    .limit(1)

  if (!row?.enabled) return null

  return {
    config: row.config ?? {},
    secrets: decryptJson<Record<string, unknown>>(row.secrets ?? null) ?? {},
  }
}

/** الأحداث اللي بنبعتها — الشرا أهمهم وأبسطهم في نفس الوقت */
export type CapiEvent = 'Purchase' | 'InitiateCheckout'

export type CapiCustomer = {
  email?: string | null
  phone?: string | null
  name?: string | null
  city?: string | null
  country?: string | null
}

export type CapiContext = {
  storeId: string
  event: CapiEvent
  /** نفس المعرّف اللي المتصفح بيبعت بيه — بيه بيتشال المكرّر */
  eventId: string
  value: number
  currency: string
  customer: CapiCustomer
  /** كوكيز ميتا من متصفح العميل — بترفع دقة المطابقة جدًا */
  fbp?: string | null
  fbc?: string | null
  clientIp?: string | null
  userAgent?: string | null
  sourceUrl?: string | null
  contentIds?: string[]
}

export type CapiResult = {
  ok: boolean
  /** إيه اللي اتبعت فعلًا — للشاشة اللي بتقيس جودة الإشارة */
  sent: string[]
  skipped: string[]
  errors: string[]
  /** كام مفتاح مطابقة كان متاحًا — من ستة */
  matchKeys: string[]
}

/**
 * تجزئة مفتاح مطابقة زي ما ميتا بتطلبها.
 *
 * التطبيع قبل التجزئة إلزامي: `Ahmed@Gmail.com ` و`ahmed@gmail.com`
 * لازم يدّوا نفس البصمة، وإلا نفس العميل بيتحسب اتنين وما بيتطابقش
 * مع حسابه عند ميتا.
 */
function hash(value: string | null | undefined): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  if (!normalized) return null
  return createHash('sha256').update(normalized).digest('hex')
}

/**
 * التليفون أرقام بس، بكود الدولة، من غير صفر بادئ ولا علامات.
 *
 * `+20 100 123 4567` و`01001234567` نفس الرقم — وميتا بتطابق على
 * الشكل الدولي وحده. الرقم المصري اللي بيبدأ بصفر بيتحوّل لـ20.
 */
function hashPhone(phone: string | null | undefined, country = 'EG'): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (!digits) return null

  /* مصر: 01xxxxxxxxx → 201xxxxxxxxx */
  if (country === 'EG' && digits.startsWith('0')) digits = `20${digits.slice(1)}`
  if (digits.length < 8) return null

  return createHash('sha256').update(digits).digest('hex')
}

/** الاسم بيتقسم — ميتا بتطابق الأول والأخير كل واحد لوحده */
function splitName(full: string | null | undefined): { first: string | null; last: string | null } {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { first: null, last: null }
  if (parts.length === 1) return { first: parts[0], last: null }
  return { first: parts[0], last: parts[parts.length - 1] }
}

/**
 * إرسال الحدث لميتا وتيك توك — والاتنين اختياريين.
 *
 * المتجر اللي حاطط بكسل من غير توكن بيتخطّى من غير خطأ: البكسل
 * لوحده شغّال في المتصفح، والتوكن هو اللي بيفتح مسار الخادم.
 */
export async function sendConversion(ctx: CapiContext): Promise<CapiResult> {
  const result: CapiResult = { ok: false, sent: [], skipped: [], errors: [], matchKeys: [] }

  const { first, last } = splitName(ctx.customer.name)
  const em = hash(ctx.customer.email)
  const ph = hashPhone(ctx.customer.phone, ctx.customer.country ?? 'EG')
  const fn = hash(first)
  const ln = hash(last)
  const ct = hash(ctx.customer.city)
  const country = hash(ctx.customer.country ?? 'eg')

  /* اللي اتجمع فعلًا — الشاشة بتقيس عليه جودة الإشارة */
  if (em) result.matchKeys.push('em')
  if (ph) result.matchKeys.push('ph')
  if (fn) result.matchKeys.push('fn')
  if (ln) result.matchKeys.push('ln')
  if (ct) result.matchKeys.push('ct')
  if (ctx.fbp) result.matchKeys.push('fbp')
  if (ctx.fbc) result.matchKeys.push('fbc')

  await Promise.all([sendMeta(ctx, { em, ph, fn, ln, ct, country }, result), sendTikTok(ctx, { em, ph }, result)])

  result.ok = result.sent.length > 0
  return result
}

type Hashed = Record<string, string | null>

async function sendMeta(ctx: CapiContext, h: Hashed, out: CapiResult): Promise<void> {
  const cfg = await pluginConfig(ctx.storeId, 'facebook_pixel')
  const pixelId = typeof cfg?.config?.pixelId === 'string' ? cfg.config.pixelId.trim() : ''
  const token = typeof cfg?.secrets?.accessToken === 'string' ? cfg.secrets.accessToken.trim() : ''

  if (!pixelId || !token) {
    out.skipped.push(pixelId ? 'meta:بلا توكن' : 'meta:مش مربوط')
    return
  }

  const userData: Record<string, unknown> = {}
  /* ميتا بتقبل مصفوفة لكل مفتاح — والفاضي بيتشال بدل ما يتبعت null */
  for (const [k, v] of Object.entries(h)) if (v) userData[k] = [v]
  if (ctx.fbp) userData.fbp = ctx.fbp
  if (ctx.fbc) userData.fbc = ctx.fbc
  if (ctx.clientIp) userData.client_ip_address = ctx.clientIp
  if (ctx.userAgent) userData.client_user_agent = ctx.userAgent

  const body = {
    data: [
      {
        event_name: ctx.event,
        event_time: Math.floor(Date.now() / 1000),
        event_id: ctx.eventId,
        action_source: 'website',
        event_source_url: ctx.sourceUrl ?? undefined,
        user_data: userData,
        custom_data: {
          /* ميتا بتتوقّع المبلغ بالوحدة الكبرى — عندنا القرش هو الأصل */
          value: Number((ctx.value / 100).toFixed(2)),
          currency: ctx.currency,
          content_ids: ctx.contentIds?.length ? ctx.contentIds : undefined,
          content_type: ctx.contentIds?.length ? 'product' : undefined,
        },
      },
    ],
  }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${pixelId}/events?access_token=${encodeURIComponent(token)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })

    if (res.ok) out.sent.push('meta')
    else {
      const txt = await res.text().catch(() => '')
      out.errors.push(`meta ${res.status}: ${txt.slice(0, 200)}`)
    }
  } catch (e) {
    out.errors.push(`meta: ${(e instanceof Error ? e.message : String(e)).slice(0, 150)}`)
  }
}

async function sendTikTok(ctx: CapiContext, h: Hashed, out: CapiResult): Promise<void> {
  const cfg = await pluginConfig(ctx.storeId, 'tiktok_pixel')
  const pixelId = typeof cfg?.config?.pixelId === 'string' ? cfg.config.pixelId.trim() : ''
  const token = typeof cfg?.secrets?.accessToken === 'string' ? cfg.secrets.accessToken.trim() : ''

  if (!pixelId || !token) {
    out.skipped.push(pixelId ? 'tiktok:بلا توكن' : 'tiktok:مش مربوط')
    return
  }

  /* تيك توك بيسمّي الشرا `CompletePayment` لا `Purchase` */
  const eventName = ctx.event === 'Purchase' ? 'CompletePayment' : 'InitiateCheckout'

  const body = {
    event_source: 'web',
    event_source_id: pixelId,
    data: [
      {
        event: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: ctx.eventId,
        user: {
          email: h.em ?? undefined,
          phone: h.ph ?? undefined,
          ip: ctx.clientIp ?? undefined,
          user_agent: ctx.userAgent ?? undefined,
        },
        page: { url: ctx.sourceUrl ?? undefined },
        properties: {
          value: Number((ctx.value / 100).toFixed(2)),
          currency: ctx.currency,
        },
      },
    ],
  }

  try {
    const res = await fetch('https://business-api.tiktok.com/open_api/v1.3/event/track/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Access-Token': token },
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    })

    const json = (await res.json().catch(() => null)) as { code?: number; message?: string } | null

    /*
      تيك توك بيرد 200 حتى لما يرفض — الحقيقة في `code`.

      نفس فخّ GraphQL بتاع شوبيفاي: من غير الفحص ده، التوكن الغلط
      بيتسجّل «اتبعت» والتاجر يفتكر إن القياس شغّال شهور.
    */
    if (res.ok && (json?.code === 0 || json?.code === undefined)) out.sent.push('tiktok')
    else out.errors.push(`tiktok ${json?.code ?? res.status}: ${(json?.message ?? '').slice(0, 150)}`)
  } catch (e) {
    out.errors.push(`tiktok: ${(e instanceof Error ? e.message : String(e)).slice(0, 150)}`)
  }
}

/**
 * تسجيل حدث الشرا عندنا — ومعاه نتيجة الإرسال.
 *
 * `store_events` فيه `type='purchase'` و`event_id` من أول يوم
 * ومحدّش كان بيكتبهم. الصف ده هو اللي بتقرا منه شاشة جودة الإشارة:
 * كام حدث خرج، وكام مفتاح مطابقة كان معاه، وإيه اللي فشل.
 */
export async function recordPurchaseEvent(input: {
  storeId: string
  orderId: string
  customerId: string | null
  eventId: string
  value: number
  currency: string
  utm: Record<string, string> | null
  path: string | null
  city: string | null
  country: string | null
  result: CapiResult
}): Promise<void> {
  await db.insert(storeEvents).values({
    storeId: input.storeId,
    type: 'purchase',
    eventId: input.eventId,
    orderId: input.orderId,
    customerId: input.customerId,
    path: input.path,
    value: input.value,
    currency: input.currency,
    utm: input.utm,
    city: input.city,
    country: input.country,
    meta: {
      capi: {
        sent: input.result.sent,
        skipped: input.result.skipped,
        errors: input.result.errors,
        matchKeys: input.result.matchKeys,
      },
    },
  })
}

/** الحدث الفارغ — للمسارات اللي بتسجّل من غير إرسال */
export const NO_CAPI: CapiResult = { ok: false, sent: [], skipped: [], errors: [], matchKeys: [] }

/** بيقول إذا كان المتجر مربوط أصلًا — عشان ما ننادّيش من غير لازمة */
export async function capiConfigured(storeId: string): Promise<boolean> {
  const [meta, tiktok] = await Promise.all([
    pluginConfig(storeId, 'facebook_pixel'),
    pluginConfig(storeId, 'tiktok_pixel'),
  ])
  const has = (c: Awaited<ReturnType<typeof pluginConfig>>) =>
    Boolean(
      typeof c?.config?.pixelId === 'string' &&
        c.config.pixelId.trim() &&
        typeof c?.secrets?.accessToken === 'string' &&
        c.secrets.accessToken.trim(),
    )
  return has(meta) || has(tiktok)
}

