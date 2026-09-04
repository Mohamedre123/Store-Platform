'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { stores } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { recordAudit } from '@/lib/audit'

export type OrderSettingsState = { ok?: boolean; error?: string } | null

/**
 * إعدادات الطلب اليدوي وترقيم الطلبات.
 *
 * البادئة واللاحقة **عرض بس** — الرقم في القاعدة وفي الروابط بيفضل
 * عددًا صحيحًا. عشان كده الفحص هنا بسيط: طول معقول وحروف بلا مسافات
 * على الطرفين، مفيش أي أثر على مفتاح.
 */
const schema = z.object({
  manualOrdersEnabled: z.boolean(),
  manualOversell: z.boolean(),
  manualCustomPricing: z.boolean(),
  manualDepositEnabled: z.boolean(),
  orderPrefix: z.string().trim().max(12).nullish(),
  orderSuffix: z.string().trim().max(12).nullish(),
  /**
   * الرقم الجاي.
   *
   * التاجر اللي بيهاجر من منصة تانية عايز يكمّل من رقمه هناك عشان
   * أرقام فواتيره ما تتكررش. بنقبل التقديم بس لا الترجيع: رقم أقل
   * من اللي وصلناه معناه تصادم مع طلب موجود، والفهرس الفريد
   * `(store_id, order_number)` هيرمي وقت أول طلب جديد لا دلوقتي —
   * فبنمنعه هنا بدل ما التاجر يكتشفه في أسوأ لحظة.
   */
  nextOrderNumber: z.coerce.number().int().min(1).max(100_000_000).optional(),
})

export async function saveOrderSettingsAction(raw: unknown): Promise<OrderSettingsState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user } = await getDashboardContext()

  let orderSequence: number | undefined
  if (typeof input.nextOrderNumber === 'number') {
    /* `orderSequence` هو آخر رقم اتصرف؛ الجاي = هو + ١ */
    const wanted = input.nextOrderNumber - 1
    if (wanted < store.orderSequence) {
      return {
        error: `الرقم الجاي لازم يكون ${store.orderSequence + 1} أو أكبر — الأقل بيتصادم مع طلب موجود.`,
      }
    }
    if (wanted !== store.orderSequence) orderSequence = wanted
  }

  await db
    .update(stores)
    .set({
      manualOrdersEnabled: input.manualOrdersEnabled,
      manualOversell: input.manualOversell,
      manualCustomPricing: input.manualCustomPricing,
      manualDepositEnabled: input.manualDepositEnabled,
      orderPrefix: input.orderPrefix?.trim() || null,
      orderSuffix: input.orderSuffix?.trim() || null,
      ...(orderSequence !== undefined ? { orderSequence } : {}),
    })
    .where(eq(stores.id, store.id))

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'order_settings',
    before: {
      manualOrdersEnabled: store.manualOrdersEnabled,
      manualCustomPricing: store.manualCustomPricing,
      manualOversell: store.manualOversell,
      orderSequence: store.orderSequence,
    },
    after: {
      manualOrdersEnabled: input.manualOrdersEnabled,
      manualCustomPricing: input.manualCustomPricing,
      manualOversell: input.manualOversell,
      orderSequence: orderSequence ?? store.orderSequence,
    },
  })

  revalidatePath('/dashboard/settings/orders')
  revalidatePath('/dashboard/orders')
  return { ok: true }
}
