import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { messagingSettings } from '@/db/schema'
import { encryptJson } from './crypto'

/**
 * ربط واتساب من غير ما التاجر يفتح حساب عند حد.
 *
 * ## المشكلة
 * الربط اليدوي معناه: التاجر يفتح موقع البوابة، ويعمل حساب، ويشترك،
 * ويعمل جلسة، ويمسح الكود هناك، وينسخ مفتاحًا، ويرجع يلزقه عندنا.
 * ست خطوات في موقعين — وأغلب التجّار بيقفوا عند التانية.
 *
 * ## الحل
 * **المنصة هي اللي عندها الحساب**، والتاجر بيمسح كود من لوحته وخلاص.
 * إحنا بننشئ له جلسة باسمه بمفتاح المنصة، ونجيب الكود، ونعرضه.
 * هو بيمسحه بموبايله زي واتساب ويب بالظبط.
 *
 * الرقم بيفضل رقمه هو، والرسايل بتطلع منه — إحنا بنشيل خطوات
 * الإعداد بس.
 *
 * ## والتاجر اللي عايز يفصل
 * لسه يقدر: صفحة الربط فيها الطريق اليدوي كمان (مفتاحه هو، أو ميتا
 * الرسمي). ده للي عنده حساب أصلًا أو مش عايز يعتمد علينا.
 */

const BASE = 'https://www.wasenderapi.com/api'

/** توكن المنصة — لو مش موجود، الربط السهل بيتقفل والباقي بيفضل شغّال */
export function platformWhatsappEnabled(): boolean {
  return Boolean(process.env.WASENDER_TOKEN)
}

type CreateResult =
  | { ok: true; sessionId: string; apiKey: string }
  | { ok: false; error: string }

async function call(
  path: string,
  init: { method: string; body?: unknown },
): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: string }> {
  const token = process.env.WASENDER_TOKEN
  if (!token) return { ok: false, error: 'الربط السهل مش مفعّل على المنصة' }

  try {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(20_000),
    })

    const text = await res.text()
    if (!res.ok) return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` }

    const parsed = JSON.parse(text) as { data?: Record<string, unknown> } & Record<string, unknown>
    return { ok: true, data: parsed.data ?? parsed }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'فشل الاتصال' }
  }
}

/**
 * جلسة جديدة للمتجر.
 *
 * الرقم بيتبعت عشان البوابة تربط الجلسة بيه، والاسم بيبان في لوحة
 * المنصة فبنخلّيه اسم المتجر — لما يبقى عندنا خمسين جلسة، «متجر
 * أتلوسا» بيفرق عن «session-42».
 */
export async function createSession(input: {
  storeId: string
  storeName: string
  phone: string
}): Promise<CreateResult> {
  const res = await call('/whatsapp-sessions', {
    method: 'POST',
    body: {
      name: input.storeName.slice(0, 60),
      phone_number: input.phone,
      /* الحماية من الحظر: بتبطّئ الإرسال شوية وبتقلّل احتمال القفل */
      account_protection: true,
      log_messages: false,
      read_incoming_messages: false,
    },
  })

  if (!res.ok) return res

  const sessionId = String(res.data.id ?? '')
  const apiKey = String(res.data.api_key ?? '')
  if (!sessionId || !apiKey) return { ok: false, error: 'رد غير متوقّع من البوابة' }

  /*
    بنحفظ فورًا حتى قبل المسح.

    لو حفظنا بعد المسح بس، التاجر اللي قفل الصفحة في نُصّها بيسيب
    جلسة معلّقة عند البوابة محدّش يعرف إنها بتاعته — وبيعمل واحدة
    جديدة كل مرة ويستهلك حد الاشتراك.
  */
  await saveSession(input.storeId, sessionId, apiKey)
  return { ok: true, sessionId, apiKey }
}

async function saveSession(storeId: string, sessionId: string, apiKey: string) {
  const values = {
    storeId,
    whatsappProvider: 'wasender' as const,
    whatsappCredentials: encryptJson({ apiKey }),
    whatsappPhoneId: sessionId,
  }

  await db
    .insert(messagingSettings)
    .values(values)
    .onConflictDoUpdate({ target: messagingSettings.storeId, set: values })
}

export type ConnectResult =
  | { ok: true; status: 'connected' }
  | { ok: true; status: 'scan'; qr: string }
  | { ok: false; error: string }

/** بيبدأ الربط ويرجّع كود المسح — أو يقول إنه متوصّل خلاص */
export async function connectSession(sessionId: string): Promise<ConnectResult> {
  const res = await call(`/whatsapp-sessions/${encodeURIComponent(sessionId)}/connect`, {
    method: 'POST',
  })

  if (!res.ok) return res

  const status = String(res.data.status ?? '').toUpperCase()
  if (status === 'ALREADY_CONNECTED' || status === 'CONNECTED') {
    return { ok: true, status: 'connected' }
  }

  const qr = String(res.data.qrCode ?? '')
  return qr
    ? { ok: true, status: 'scan', qr }
    : { ok: false, error: 'البوابة ما رجّعتش كود مسح' }
}

/**
 * حالة الجلسة.
 *
 * بتتنادى كل شوية والصفحة مفتوحة: العميل بيمسح الكود بموبايله،
 * ومفيش حاجة بتقول للصفحة إنه خلص غير السؤال.
 */
export async function sessionStatus(sessionId: string): Promise<'connected' | 'waiting' | 'unknown'> {
  const res = await call(`/whatsapp-sessions/${encodeURIComponent(sessionId)}`, { method: 'GET' })
  if (!res.ok) return 'unknown'

  const status = String(res.data.status ?? '').toUpperCase()
  if (status === 'CONNECTED' || status === 'ALREADY_CONNECTED') return 'connected'
  if (status === 'NEED_SCAN' || status === 'DISCONNECTED') return 'waiting'
  return 'unknown'
}

/** فصل الرقم — التاجر بيغيّر رقمه أو بيوقف الخدمة */
export async function deleteSession(sessionId: string): Promise<void> {
  await call(`/whatsapp-sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}
