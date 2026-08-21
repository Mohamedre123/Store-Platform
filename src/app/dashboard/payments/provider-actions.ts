'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { getDashboardContext } from '@/lib/store-context'
import { recordAudit } from '@/lib/audit'
import { savePaymentProvider, saveCarrierProvider, type SaveResult } from '@/lib/provider-store'
import { carrierProvider, paymentProvider } from '@/lib/providers'

const schema = z.object({
  slug: z.string().trim().min(1),
  enabled: z.boolean(),
  values: z.record(z.string(), z.string().max(500)),
  testMode: z.boolean(),
  /** سعر الشحن بالجنيه — لشركات الشحن بس */
  flatRate: z.coerce.number().min(0).max(100000).optional(),
  freeOver: z.coerce.number().min(0).max(1000000).optional(),
})

/**
 * حفظ بوابة دفع.
 *
 * التفعيل بيتسجّل في سجل النشاط: ربط بوابة دفع بيحدّد فلوس المتجر
 * بتروح فين، وده من أخطر إجراءين في اللوحة (التاني تغيير النطاق).
 * لازم يفضل ليه أثر باسم اللي عمله.
 */
export async function savePaymentProviderAction(raw: unknown): Promise<SaveResult> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: 'بيانات ناقصة' }

  const def = paymentProvider(parsed.data.slug)
  if (!def) return { error: 'البوابة دي مش معروفة' }

  const { store, user } = await getDashboardContext()
  const res = await savePaymentProvider(store.id, parsed.data.slug, parsed.data)
  if (res.error) return res

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'payment_gateway',
    resourceId: parsed.data.slug,
    after: {
      gateway: def.name,
      enabled: parsed.data.enabled,
      testMode: parsed.data.testMode,
      // المفاتيح نفسها ما بتتسجّلش — سجل النشاط بيتقرا من اللوحة
      keysChanged: Object.keys(parsed.data.values).filter((k) => parsed.data.values[k]),
    },
  })

  revalidatePath('/dashboard/payments')
  return { ok: true }
}

export async function saveCarrierProviderAction(raw: unknown): Promise<SaveResult> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: 'بيانات ناقصة' }

  const def = carrierProvider(parsed.data.slug)
  if (!def) return { error: 'الشركة دي مش معروفة' }

  const { store, user } = await getDashboardContext()
  const res = await saveCarrierProvider(store.id, parsed.data.slug, parsed.data)
  if (res.error) return res

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'carrier',
    resourceId: parsed.data.slug,
    after: { carrier: def.name, enabled: parsed.data.enabled, testMode: parsed.data.testMode },
  })

  revalidatePath('/dashboard/shipping')
  return { ok: true }
}
