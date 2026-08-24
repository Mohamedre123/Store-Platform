import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { messagingSettings } from '@/db/schema'
import { decryptJson, encryptJson } from './crypto'
import type { Templates } from './whatsapp-templates'

/**
 * إرسال واتساب — بمزوّد يختاره التاجر.
 *
 * ## ليه مزوّدين
 * الطريق الرسمي (واتساب بزنس من ميتا) بيطلب حساب أعمال متحقَّق منه،
 * ورقم بيتشال من تطبيق واتساب العادي، وقوالب تتراجع قبل ما تتبعت.
 * ده مناسب لتاجر كبير، وسدّ في وش أغلب التجّار.
 *
 * والبوابات غير الرسمية بتربط رقم عادي بمسح كود، وبتبعت نصًا حرًا
 * من غير قوالب ولا مراجعة — دقايق بدل أسابيع.
 *
 * **ومقابل السهولة دي فيه مخاطرة:** الطريقة دي مش معتمدة من واتساب،
 * والرقم ممكن يتقفل. مكتوبة للتاجر بالنص في صفحة الربط عشان يقرّر
 * وهو عارف، مش يكتشف بعدين.
 *
 * الملف ده هو الحاجز: اللي بينادي بينادي `sendWhatsapp` وخلاص. لو
 * التاجر بدّل مزوّده، ولا سطر تاني في المشروع بيتغيّر.
 */

export type WhatsappProvider = 'off' | 'wasender' | 'cloud'

export type WhatsappSettings = {
  provider: WhatsappProvider
  /** مفتاح الجلسة — بيتخزّن مشفّرًا وما بيرجعش للمتصفح أبدًا */
  hasKey: boolean
  /** توكن حساب التاجر — بيه بيتعمل الربط بمسح الكود */
  hasAccessToken: boolean
  /** معرّف رقم الهاتف أو الجلسة */
  phoneId: string | null
}

/**
 * أسرار واتساب المتجر.
 *
 * `accessToken` توكن حساب **التاجر** عند البوابة — بيه بننشئ له
 * جلسة ونجيب كود المسح من جوّه لوحته. `apiKey` مفتاح الجلسة نفسها،
 * وبيه بيتم الإرسال.
 *
 * الاتنين بتوعه هو: الحساب باسمه والفاتورة عليه.
 */
type Secrets = { apiKey?: string; token?: string; accessToken?: string }

/* ────────────────────────── القراءة والحفظ ────────────────────────── */

export async function readWhatsapp(storeId: string): Promise<WhatsappSettings> {
  const [row] = await db
    .select({
      provider: messagingSettings.whatsappProvider,
      creds: messagingSettings.whatsappCredentials,
      phoneId: messagingSettings.whatsappPhoneId,
    })
    .from(messagingSettings)
    .where(eq(messagingSettings.storeId, storeId))
    .limit(1)

  const secrets = decryptJson<Secrets>(row?.creds ?? null)

  return {
    provider: normalizeProvider(row?.provider),
    hasKey: Boolean(secrets?.apiKey ?? secrets?.token),
    hasAccessToken: Boolean(secrets?.accessToken),
    phoneId: row?.phoneId ?? null,
  }
}

/** توكن حساب التاجر — للاستعمال الداخلي وقت الربط */
export async function readAccessToken(storeId: string): Promise<string | null> {
  const [row] = await db
    .select({ creds: messagingSettings.whatsappCredentials })
    .from(messagingSettings)
    .where(eq(messagingSettings.storeId, storeId))
    .limit(1)

  return decryptJson<Secrets>(row?.creds ?? null)?.accessToken ?? null
}

/**
 * دمج سرّ جديد فوق الموجود.
 *
 * الحفظ الكامل كان بيمسح اللي مش متبعت: التاجر يحطّ توكن حسابه،
 * وبعدين الربط يحفظ مفتاح الجلسة — فيمسح التوكن ويبقى مش قادر
 * يعيد الربط من غير ما يعرف ليه.
 */
export async function mergeSecrets(storeId: string, patch: Secrets): Promise<void> {
  const [row] = await db
    .select({ creds: messagingSettings.whatsappCredentials })
    .from(messagingSettings)
    .where(eq(messagingSettings.storeId, storeId))
    .limit(1)

  const merged = encryptJson({ ...(decryptJson<Secrets>(row?.creds ?? null) ?? {}), ...patch })

  await db
    .insert(messagingSettings)
    .values({ storeId, whatsappCredentials: merged })
    .onConflictDoUpdate({
      target: messagingSettings.storeId,
      set: { whatsappCredentials: merged },
    })
}

/**
 * القيم القديمة بتتترجم.
 *
 * الجدول كان بيخزّن `platform`/`custom`، والكود اللي بيقرا كان
 * بيتوقّع `custom` بمعنى «ميتا». المتجر المحفوظ قبل التغيير لازم
 * يفضل شغّالًا من غير ترحيل.
 */
function normalizeProvider(raw: string | null | undefined): WhatsappProvider {
  if (raw === 'wasender' || raw === 'cloud' || raw === 'off') return raw
  if (raw === 'custom' || raw === 'platform') return 'cloud'
  return 'off'
}

export async function saveWhatsapp(
  storeId: string,
  input: { provider: WhatsappProvider; apiKey?: string; phoneId?: string },
): Promise<void> {
  const current = await db
    .select({ creds: messagingSettings.whatsappCredentials })
    .from(messagingSettings)
    .where(eq(messagingSettings.storeId, storeId))
    .limit(1)

  /*
    المفتاح الفاضي معناه «سيبه زي ما هو».

    الواجهة ما بتعرضش المفتاح المحفوظ أبدًا، فالتاجر اللي بيغيّر
    معرّف الرقم بس بيبعت خانة مفتاح فاضية — ولو خدناها على ظاهرها
    كنّا هنمسح مفتاحه وهو مش عارف.
  */
  const existing = decryptJson<Secrets>(current[0]?.creds ?? null) ?? {}
  const secrets: string | null = input.apiKey?.trim()
    ? encryptJson({ ...existing, apiKey: input.apiKey.trim() } satisfies Secrets)
    : (current[0]?.creds ?? null)

  const values = {
    storeId,
    whatsappProvider: input.provider,
    whatsappCredentials: input.provider === 'off' ? null : secrets,
    whatsappPhoneId: input.phoneId?.trim() || null,
  }

  await db
    .insert(messagingSettings)
    .values(values)
    .onConflictDoUpdate({ target: messagingSettings.storeId, set: values })
}

/* ────────────────────────── الإرسال ────────────────────────── */

export type SendResult = { ok: true } | { ok: false; error: string }

/**
 * رقم بصيغة E.164 بعلامة زائد.
 *
 * `normalizePhone` بترجّعه كده أصلًا، بس الأرقام اللي جاية من جداول
 * قديمة ممكن تكون بلا علامة. البوابة بترفض الاتنين بشكل مختلف —
 * فبنوحّدهم هنا مرة واحدة.
 */
function e164(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  return digits ? `+${digits}` : ''
}

export async function sendWhatsapp(
  storeId: string,
  phone: string,
  text: string,
): Promise<SendResult> {
  const to = e164(phone)
  if (to.length < 9) return { ok: false, error: 'رقم غير صالح' }

  const [row] = await db
    .select({
      provider: messagingSettings.whatsappProvider,
      creds: messagingSettings.whatsappCredentials,
      phoneId: messagingSettings.whatsappPhoneId,
    })
    .from(messagingSettings)
    .where(eq(messagingSettings.storeId, storeId))
    .limit(1)

  const provider = normalizeProvider(row?.provider)
  if (provider === 'off') return { ok: false, error: 'واتساب مش مربوط' }

  const secrets = decryptJson<Secrets>(row?.creds ?? null)
  const key = secrets?.apiKey ?? secrets?.token
  if (!key) return { ok: false, error: 'مفتاح واتساب ناقص' }

  return provider === 'wasender'
    ? sendViaWasender(key, to, text)
    : sendViaCloud(key, row?.phoneId ?? '', to, text)
}

/** البوابة السهلة — رقم عادي مربوط بمسح كود */
async function sendViaWasender(key: string, to: string, text: string): Promise<SendResult> {
  try {
    const res = await fetch('https://www.wasenderapi.com/api/send-message', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, text }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const body = await res.text()
      /*
        نص المزوّد بيتقال زي ما هو: هو اللي بيفرّق بين «الجلسة اتفصلت
        امسح الكود تاني» و«خلص رصيدك». الرسالة العامة بتخلّي التاجر
        يقعد يجرّب من غير ما يعرف يعمل إيه.
      */
      return { ok: false, error: `${res.status}: ${body.slice(0, 200)}` }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'فشل الاتصال' }
  }
}

/** الطريق الرسمي — واتساب بزنس من ميتا */
async function sendViaCloud(
  token: string,
  phoneId: string,
  to: string,
  text: string,
): Promise<SendResult> {
  if (!phoneId) return { ok: false, error: 'معرّف رقم واتساب ناقص' }

  try {
    const res = await fetch(`https://graph.facebook.com/v21.0/${phoneId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        // ميتا بتاخد الرقم بأرقامه من غير علامة زائد
        to: to.replace(/\D/g, ''),
        type: 'text',
        text: { body: text },
      }),
      signal: AbortSignal.timeout(15_000),
    })

    if (!res.ok) {
      const body = await res.text()
      return { ok: false, error: `${res.status}: ${body.slice(0, 200)}` }
    }

    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'فشل الاتصال' }
  }
}

/** فيه واتساب شغّال للمتجر ده؟ — قبل ما نوعد العميل برسالة */
export async function whatsappReady(storeId: string): Promise<boolean> {
  const s = await readWhatsapp(storeId)
  return s.provider !== 'off' && s.hasKey
}

/* ────────────────────────── القوالب ────────────────────────── */

/** نصوص التاجر — الفاضي معناه «استعمل الافتراضي» */
export async function readTemplates(storeId: string): Promise<Templates> {
  const [row] = await db
    .select({ t: messagingSettings.whatsappTemplates })
    .from(messagingSettings)
    .where(eq(messagingSettings.storeId, storeId))
    .limit(1)

  return (row?.t ?? {}) as Templates
}

export async function saveTemplates(storeId: string, templates: Templates): Promise<void> {
  /* الفاضي بيتشال بدل ما يتخزّن — عشان يرجع للافتراضي فعلًا */
  const clean: Templates = {}
  for (const [k, v] of Object.entries(templates)) {
    const text = v?.trim()
    if (text) clean[k as keyof Templates] = text
  }

  await db
    .insert(messagingSettings)
    .values({ storeId, whatsappTemplates: clean })
    .onConflictDoUpdate({
      target: messagingSettings.storeId,
      set: { whatsappTemplates: clean },
    })
}