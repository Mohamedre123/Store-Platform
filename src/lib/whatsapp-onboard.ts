import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { messagingSettings } from '@/db/schema'
import { mergeSecrets } from './whatsapp'

/**
 * ربط واتساب من جوّه لوحة التاجر.
 *
 * ## المشكلة
 * الربط اليدوي معناه: التاجر يفتح موقع البوابة، ويعمل جلسة، ويمسح
 * الكود هناك، وينسخ مفتاحًا، ويرجع يلزقه عندنا. خطوات في موقعين —
 * وأغلب التجّار بيقفوا في نُصّها.
 *
 * ## الحل
 * التاجر بيلزق **توكن حسابه** مرة واحدة، وبعدها كل حاجة بتحصل جوّه
 * لوحته: بننشئ له جلسة، ونجيب كود المسح، ونعرضه، ونتابع الحالة.
 * هو بيمسح بموبايله زي واتساب ويب بالظبط.
 *
 * **الحساب باسمه والفاتورة عليه.** إحنا بنشيل خطوات الإعداد بس، مش
 * التكلفة — ولا بيانات تاجر بتعدّي على حساب تاجر تاني.
 *
 * ولو المنصة حبّت تتحمّل التكلفة يومًا، `WASENDER_TOKEN` بيشتغل
 * كبديل للتجّار اللي مالهمش توكن — من غير أي تغيير تاني في الكود.
 */

const BASE = 'https://www.wasenderapi.com/api'

/** توكن احتياطي على مستوى المنصة — اختياري تمامًا */
export function platformToken(): string | null {
  return process.env.WASENDER_TOKEN || null
}

type CreateResult =
  | { ok: true; sessionId: string; apiKey: string }
  | { ok: false; error: string }

type CallResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string }

async function call(
  token: string,
  path: string,
  init: { method: string; body?: unknown },
): Promise<CallResult> {
  if (!token) return { ok: false, error: 'محتاجين توكن حسابك على البوابة الأول' }

  try {
    const res = await fetch(`${BASE}${path}`, {
      method: init.method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(init.body ? { body: JSON.stringify(init.body) } : {}),
      signal: AbortSignal.timeout(20_000),
    })

    const text = await res.text()
    /*
      نص البوابة بيتقال زي ما هو: «التوكن غلط» و«خلص عدد الجلسات في
      باقتك» حلّهم مختلف تمامًا، والرسالة العامة بتخلّي التاجر يقعد
      يجرّب من غير ما يعرف يعمل إيه.
    */
    if (!res.ok) return { ok: false, error: `${res.status}: ${text.slice(0, 200)}` }

    const parsed = JSON.parse(text) as { data?: Record<string, unknown> } & Record<string, unknown>
    return { ok: true, data: parsed.data ?? parsed }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'فشل الاتصال بالبوابة' }
  }
}

/**
 * جلسة جديدة للمتجر.
 *
 * الاسم بيبان في لوحة البوابة فبنخلّيه اسم المتجر — التاجر اللي
 * عنده أكتر من متجر بيفرّق بينهم من غير ما يفتح كل واحدة.
 */
export async function createSession(input: {
  token: string
  storeId: string
  storeName: string
  phone: string
}): Promise<CreateResult> {
  const res = await call(input.token, '/whatsapp-sessions', {
    method: 'POST',
    body: {
      name: input.storeName.slice(0, 60),
      phone_number: input.phone,
      /* بتبطّئ الإرسال شوية وبتقلّل احتمال قفل الرقم */
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
    جديدة كل مرة وياكل من حد باقته.
  */
  await mergeSecrets(input.storeId, { apiKey })
  await db
    .insert(messagingSettings)
    .values({ storeId: input.storeId, whatsappProvider: 'wasender', whatsappPhoneId: sessionId })
    .onConflictDoUpdate({
      target: messagingSettings.storeId,
      set: { whatsappProvider: 'wasender', whatsappPhoneId: sessionId },
    })

  return { ok: true, sessionId, apiKey }
}

export type ConnectResult =
  | { ok: true; status: 'connected' }
  | { ok: true; status: 'scan'; qr: string }
  | { ok: false; error: string }

/** بيبدأ الربط ويرجّع كود المسح — أو يقول إنه متوصّل خلاص */
export async function connectSession(token: string, sessionId: string): Promise<ConnectResult> {
  const res = await call(token, `/whatsapp-sessions/${encodeURIComponent(sessionId)}/connect`, {
    method: 'POST',
  })

  if (!res.ok) return res

  const status = String(res.data.status ?? '').toUpperCase()
  if (status === 'ALREADY_CONNECTED' || status === 'CONNECTED') {
    return { ok: true, status: 'connected' }
  }

  const qr = String(res.data.qrCode ?? '')
  return qr ? { ok: true, status: 'scan', qr } : { ok: false, error: 'البوابة ما رجّعتش كود مسح' }
}

/**
 * حالة الجلسة.
 *
 * بتتنادى كل شوية والصفحة مفتوحة: التاجر بيمسح الكود بموبايله،
 * ومفيش حاجة بتقول للصفحة إنه خلص غير السؤال.
 */
export async function sessionStatus(
  token: string,
  sessionId: string,
): Promise<'connected' | 'waiting' | 'unknown'> {
  const res = await call(token, `/whatsapp-sessions/${encodeURIComponent(sessionId)}`, {
    method: 'GET',
  })
  if (!res.ok) return 'unknown'

  const status = String(res.data.status ?? '').toUpperCase()
  if (status === 'CONNECTED' || status === 'ALREADY_CONNECTED') return 'connected'
  if (status === 'NEED_SCAN' || status === 'DISCONNECTED') return 'waiting'
  return 'unknown'
}

/** فصل الرقم — بيتشال من البوابة كمان عشان ما ياكلش من حد الباقة */
export async function deleteSession(token: string, sessionId: string): Promise<void> {
  await call(token, `/whatsapp-sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' })
}
