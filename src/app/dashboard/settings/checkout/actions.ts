'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { checkoutSettings } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { recordAudit } from '@/lib/audit'

export type CheckoutState = { ok?: boolean; error?: string } | null

const field = z.enum(['required', 'optional', 'hidden'])

/**
 * إعدادات الشيك أوت.
 *
 * ## ليه كل حقل بيتحقّق منه هنا
 * القيم جاية من المتصفح، والصفحة دي بتتحكّم في **أهم شاشة في المتجر**.
 * قيمة غلط في `addressMode` مثلًا بتخلّي الشيك أوت يرسم حقولًا مالهاش
 * معنى، والتاجر ما يكتشفش غير لما عميل يشتكي إنه مش قادر يطلب.
 */
const schema = z.object({
  /* الخانات */
  fieldName: field,
  fieldPhone: field,
  fieldEmail: field,
  fieldCity: field,
  fieldArea: field,
  fieldStreet: field,
  fieldBuilding: field,
  fieldPostalCode: field,
  fieldCountry: field,
  fieldNotes: field,

  /* العنوان والتوصيل */
  addressMode: z.enum(['structured', 'simple', 'hidden']),
  deliveryMode: z.enum(['delivery_pickup', 'delivery', 'pickup']),
  showCountryCodePicker: z.boolean(),

  /* الشاشة */
  smartMode: z.boolean(),
  showPaymentSelector: z.boolean(),
  showCouponField: z.boolean(),

  /* الدفع السريع */
  quickCheckoutEnabled: z.boolean(),
  quickCheckoutStyle: z.enum(['inline', 'drawer']),
  quickCheckoutShowItems: z.boolean(),
  whatsappOrderEnabled: z.boolean(),

  /* السلة */
  cartUpsellEnabled: z.boolean(),
  minOrderEnabled: z.boolean(),
  /** بالقرش زي كل مبالغ المنصة */
  minOrderAmount: z.coerce.number().int().min(0).max(100_000_000),

  /* التحقق والتأكيد */
  otpEnabled: z.boolean(),
  captureIncompleteOrders: z.boolean(),
  autoConfirmEnabled: z.boolean(),
  autoConfirmDelay: z.coerce.number().int().min(1).max(180),
})

export async function saveCheckoutSettingsAction(raw: unknown): Promise<CheckoutState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'فيه إعداد قيمته مش مظبوطة' }
  }

  const { store, user } = await getDashboardContext()
  const input = parsed.data

  /*
    الاسم والرقم ما ينفعش يتخفوا.

    الطلب من غير رقم ما ينفعش يتشحن ولا يتأكّد، والتاجر اللي بيخفيهم
    بيكتشف ده بعد أول عشر طلبات ملهاش صاحب. المنع هنا لا في الواجهة
    بس — الفعل ده بيتنادى مباشرةً كمان.
  */
  if (input.fieldName === 'hidden' || input.fieldPhone === 'hidden') {
    return { error: 'الاسم والرقم ما ينفعش يتخفوا — من غيرهم الطلب مالوش صاحب.' }
  }

  await db
    .insert(checkoutSettings)
    .values({ storeId: store.id, ...input })
    .onConflictDoUpdate({ target: checkoutSettings.storeId, set: input })

  await recordAudit({
    storeId: store.id,
    userId: user.id,
    action: 'settings.update',
    resource: 'checkout_settings',
    resourceId: store.id,
    after: input,
  })

  revalidatePath('/dashboard/settings/checkout')
  return { ok: true }
}
