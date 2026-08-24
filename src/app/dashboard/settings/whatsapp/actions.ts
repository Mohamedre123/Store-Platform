'use server'

import { revalidatePath } from 'next/cache'
import { getDashboardContext } from '@/lib/store-context'
import { readWhatsapp, saveWhatsapp, sendWhatsapp, type WhatsappProvider } from '@/lib/whatsapp'
import { normalizePhone } from '@/lib/utils'

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
