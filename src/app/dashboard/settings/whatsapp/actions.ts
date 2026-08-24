'use server'

import { revalidatePath } from 'next/cache'
import { getDashboardContext } from '@/lib/store-context'
import { readWhatsapp, saveWhatsapp, sendWhatsapp, type WhatsappProvider } from '@/lib/whatsapp'
import { normalizePhone } from '@/lib/utils'
import QRCode from 'qrcode'
import {
  connectSession,
  createSession,
  deleteSession,
  platformWhatsappEnabled,
  sessionStatus,
} from '@/lib/whatsapp-onboard'

export type WaState = { ok?: boolean; error?: string; note?: string } | null

export async function saveWhatsappAction(input: {
  provider: WhatsappProvider
  apiKey: string
  phoneId: string
}): Promise<WaState> {
  const { store } = await getDashboardContext()

  if (input.provider === 'cloud' && !input.phoneId.trim()) {
    return { error: 'معرّف رقم واتساب مطلوب مع الطريق الرسمي' }
  }

  const current = await readWhatsapp(store.id)
  if (input.provider !== 'off' && !input.apiKey.trim() && !current.hasKey) {
    return { error: 'حطّ المفتاح الأول' }
  }

  await saveWhatsapp(store.id, {
    provider: input.provider,
    apiKey: input.apiKey,
    phoneId: input.phoneId,
  })

  revalidatePath('/dashboard/settings/whatsapp')
  return { ok: true }
}

/**
 * إرسال تجريبي.
 *
 * التاجر يعرف إن الربط شغّال **قبل** ما عميل يستنّى رمز دخول ما
 * وصلش. ولو فشل، بيشوف نص الخطأ من البوابة زي ما هو — «الجلسة
 * اتفصلت» و«خلص رصيدك» حلّهم مختلف تمامًا.
 */
export async function testWhatsappAction(phone: string): Promise<WaState> {
  const { store } = await getDashboardContext()

  const to = normalizePhone(phone, store.country === 'EG' ? '20' : '966')
  if (to.replace(/\D/g, '').length < 10) return { error: 'اكتب رقمًا صحيحًا' }

  const res = await sendWhatsapp(
    store.id,
    to,
    `رسالة تجربة من ${store.name} — الربط شغّال ✅`,
  )

  return res.ok ? { ok: true, note: 'اتبعتت. شوف واتسابك.' } : { error: res.error }
}

/* ────────────────────────── الربط السهل ────────────────────────── */

export type LinkState =
  | { ok: true; status: 'connected' }
  | { ok: true; status: 'scan'; qrImage: string }
  | { ok: false; error: string }

/**
 * ربط رقم التاجر من غير ما يفتح حساب عند حد.
 *
 * المنصة عندها الحساب، وبتعمل للتاجر جلسة باسمه، وبترجّع كود مسح
 * يظهر في لوحته. هو بيمسحه بموبايله زي واتساب ويب — وخلاص.
 *
 * الكود بيتحوّل لصورة على الخادم: البوابة بترجّع نصًا خامًا، ولو
 * بعتناه للمتصفح زي ما هو مش هيبقى قدام التاجر غير حروف مالهاش معنى.
 */
export async function linkWhatsappAction(phone: string): Promise<LinkState> {
  const { store } = await getDashboardContext()

  if (!platformWhatsappEnabled()) {
    return { ok: false, error: 'الربط السهل مش مفعّل — استعمل الربط اليدوي تحت' }
  }

  const to = normalizePhone(phone, store.country === 'EG' ? '20' : '966')
  if (to.replace(/\D/g, '').length < 10) return { ok: false, error: 'اكتب رقم واتساب صحيح' }

  /* جلسة موجودة؟ نكمّل عليها بدل ما نستهلك واحدة جديدة */
  const current = await readWhatsapp(store.id)
  let sessionId = current.provider === 'wasender' ? current.phoneId : null

  if (!sessionId) {
    const created = await createSession({ storeId: store.id, storeName: store.name, phone: to })
    if (!created.ok) return { ok: false, error: created.error }
    sessionId = created.sessionId
  }

  const res = await connectSession(sessionId)
  if (!res.ok) return { ok: false, error: res.error }

  revalidatePath('/dashboard/settings/whatsapp')

  if (res.status === 'connected') return { ok: true, status: 'connected' }

  const qrImage = await QRCode.toDataURL(res.qr, { width: 320, margin: 1 })
  return { ok: true, status: 'scan', qrImage }
}

/** الصفحة بتسأل كل شوية: العميل مسح الكود ولا لسه؟ */
export async function whatsappStatusAction(): Promise<'connected' | 'waiting' | 'unknown'> {
  const { store } = await getDashboardContext()
  const current = await readWhatsapp(store.id)
  if (current.provider !== 'wasender' || !current.phoneId) return 'unknown'
  return sessionStatus(current.phoneId)
}

/** فصل الرقم — بيتشال من البوابة كمان عشان ما ياكلش من حد الاشتراك */
export async function unlinkWhatsappAction(): Promise<WaState> {
  const { store } = await getDashboardContext()
  const current = await readWhatsapp(store.id)

  if (current.provider === 'wasender' && current.phoneId && platformWhatsappEnabled()) {
    await deleteSession(current.phoneId)
  }

  await saveWhatsapp(store.id, { provider: 'off' })
  revalidatePath('/dashboard/settings/whatsapp')
  return { ok: true, note: 'الرقم اتفصل' }
}
