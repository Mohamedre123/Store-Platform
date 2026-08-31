'use server'

import { revalidatePath } from 'next/cache'
import { getDashboardContext } from '@/lib/store-context'
import {
  mergeSecrets,
  readAccessToken,
  readWhatsapp,
  saveTemplates,
  saveWhatsapp,
  sendWhatsapp,
  type WhatsappProvider,
} from '@/lib/whatsapp'
import { normalizePhone } from '@/lib/utils'
import { appUrl } from '@/lib/domain'
import { checkTemplates, type Templates } from '@/lib/whatsapp-templates'
import QRCode from 'qrcode'
import {
  connectSession,
  createSession,
  deleteSession,
  platformToken,
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

/* ────────────────────────── الربط بمسح كود ────────────────────────── */

export type LinkState =
  | { ok: true; status: 'connected' }
  | { ok: true; status: 'scan'; qrImage: string }
  | { ok: false; error: string }

/**
 * توكن حساب التاجر عند البوابة.
 *
 * الحساب باسمه والفاتورة عليه — إحنا بنشيل خطوات الإعداد بس.
 * ولو المنصة حاطّة توكنًا عامًا، بيشتغل كبديل للي مالوش واحد.
 */
async function tokenFor(storeId: string): Promise<string | null> {
  return (await readAccessToken(storeId)) ?? platformToken()
}

/** بيحفظ توكن حساب التاجر — أول وآخر حاجة بيلزقها */
export async function saveAccessTokenAction(token: string): Promise<WaState> {
  const { store } = await getDashboardContext()
  const clean = token.trim()
  if (clean.length < 10) return { error: 'التوكن قصير أوي — راجعه' }

  await mergeSecrets(store.id, { accessToken: clean })
  revalidatePath('/dashboard/settings/whatsapp')
  return { ok: true, note: 'اتحفظ. اكتب رقمك ودوس اربط.' }
}

/**
 * ربط رقم التاجر من جوّه لوحته.
 *
 * بننشئ له جلسة بتوكنه، ونجيب كود المسح، ونعرضه. هو بيمسحه
 * بموبايله زي واتساب ويب — وخلاص.
 *
 * الكود بيتحوّل لصورة على الخادم: البوابة بترجّع نصًا خامًا، ولو
 * بعتناه للمتصفح زي ما هو مش هيبقى قدام التاجر غير حروف مالهاش معنى.
 */
export async function linkWhatsappAction(phone: string): Promise<LinkState> {
  const { store } = await getDashboardContext()

  const token = await tokenFor(store.id)
  if (!token) return { ok: false, error: 'حطّ توكن حسابك على البوابة الأول' }

  const to = normalizePhone(phone, store.country === 'EG' ? '20' : '966')
  if (to.replace(/\D/g, '').length < 10) return { ok: false, error: 'اكتب رقم واتساب صحيح' }

  /* جلسة موجودة؟ نكمّل عليها بدل ما نستهلك واحدة جديدة من باقته */
  const current = await readWhatsapp(store.id)
  let sessionId = current.provider === 'wasender' ? current.phoneId : null

  if (!sessionId) {
    const created = await createSession({
      token,
      storeId: store.id,
      storeName: store.name,
      phone: to,
      /*
        عنوان استقبال ردود العملاء على تأكيد الطلب.

        بمعرّف المتجر في المسار: البوابة بتبعت رقم ورسالة وبس،
        فمن غير المعرّف مش هنعرف الرد ده بتاع أنهي متجر.
      */
      webhookUrl: appUrl(`/api/webhooks/whatsapp/${store.id}`),
    })
    if (!created.ok) return { ok: false, error: created.error }
    sessionId = created.sessionId
  }

  const res = await connectSession(token, sessionId)
  if (!res.ok) return { ok: false, error: res.error }

  revalidatePath('/dashboard/settings/whatsapp')

  if (res.status === 'connected') return { ok: true, status: 'connected' }

  const qrImage = await QRCode.toDataURL(res.qr, { width: 320, margin: 1 })
  return { ok: true, status: 'scan', qrImage }
}

/** الصفحة بتسأل كل شوية: التاجر مسح الكود ولا لسه؟ */
export async function whatsappStatusAction(): Promise<'connected' | 'waiting' | 'unknown'> {
  const { store } = await getDashboardContext()
  const current = await readWhatsapp(store.id)
  if (current.provider !== 'wasender' || !current.phoneId) return 'unknown'

  const token = await tokenFor(store.id)
  if (!token) return 'unknown'
  return sessionStatus(token, current.phoneId)
}

/** فصل الرقم — بيتشال من البوابة كمان عشان ما ياكلش من حد باقته */
export async function unlinkWhatsappAction(): Promise<WaState> {
  const { store } = await getDashboardContext()
  const current = await readWhatsapp(store.id)
  const token = await tokenFor(store.id)

  if (current.provider === 'wasender' && current.phoneId && token) {
    await deleteSession(token, current.phoneId)
  }

  await saveWhatsapp(store.id, { provider: 'off' })
  revalidatePath('/dashboard/settings/whatsapp')
  return { ok: true, note: 'الرقم اتفصل' }
}

/* ────────────────────────── نصوص الرسايل ────────────────────────── */

/**
 * حفظ نصوص التاجر.
 *
 * الفحص قبل الحفظ لا بعده: قالب رمز الدخول من غير `{{كود}}` بيخلّي
 * العميل ياخد رسالة مالهاش لازمة ومش قادر يدخل — ودي حاجة التاجر
 * ما بيكتشفهاش غير لما حد يشتكي.
 */
export async function saveTemplatesAction(templates: Templates): Promise<WaState> {
  const { store } = await getDashboardContext()

  const issues = checkTemplates(templates)
  if (issues.length) return { error: issues[0].message }

  await saveTemplates(store.id, templates)
  revalidatePath('/dashboard/settings/whatsapp')
  return { ok: true, note: 'النصوص اتحفظت' }
}
