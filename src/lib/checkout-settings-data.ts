import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { checkoutSettings } from '@/db/schema'
import type { CheckoutSettingsValues } from '@/app/dashboard/settings/checkout/checkout-settings-form'

/**
 * إعدادات الشيك أوت بتاعة المتجر — صفحة اللوحة ومسار التطبيق
 * (`/api/app/checkout-settings`) بيقروا من هنا.
 *
 * الصف ممكن ما يكونش موجود.
 *
 * بيتعمل مع التسجيل، لكن المتاجر اللي اتعملت قبل ما الجدول يتضاف
 * مالهاش صف. القيم دي هي نفس افتراضيات المخطط، والحفظ بيعمل
 * `insert … on conflict` فبيتظبط من أول حفظة.
 */
export async function loadCheckoutSettings(storeId: string): Promise<CheckoutSettingsValues> {
  const [row] = await db
    .select()
    .from(checkoutSettings)
    .where(eq(checkoutSettings.storeId, storeId))
    .limit(1)

  return {
    fieldName: row?.fieldName ?? 'required',
    fieldPhone: row?.fieldPhone ?? 'required',
    fieldEmail: row?.fieldEmail ?? 'optional',
    fieldCity: row?.fieldCity ?? 'required',
    fieldArea: row?.fieldArea ?? 'optional',
    fieldStreet: row?.fieldStreet ?? 'required',
    fieldBuilding: row?.fieldBuilding ?? 'optional',
    fieldPostalCode: row?.fieldPostalCode ?? 'hidden',
    fieldCountry: row?.fieldCountry ?? 'hidden',
    fieldNotes: row?.fieldNotes ?? 'optional',
    addressMode: row?.addressMode ?? 'structured',
    deliveryMode: row?.deliveryMode ?? 'delivery',
    showCountryCodePicker: row?.showCountryCodePicker ?? true,
    smartMode: row?.smartMode ?? true,
    showPaymentSelector: row?.showPaymentSelector ?? true,
    showCouponField: row?.showCouponField ?? true,
    quickCheckoutEnabled: row?.quickCheckoutEnabled ?? true,
    quickCheckoutStyle: row?.quickCheckoutStyle ?? 'drawer',
    quickCheckoutShowItems: row?.quickCheckoutShowItems ?? true,
    whatsappOrderEnabled: row?.whatsappOrderEnabled ?? false,
    cartUpsellEnabled: row?.cartUpsellEnabled ?? true,
    cartUpsellProductIds: row?.cartUpsellProductIds ?? [],
    minOrderEnabled: row?.minOrderEnabled ?? false,
    minOrderAmount: row?.minOrderAmount ?? 0,
    otpEnabled: row?.otpEnabled ?? true,
    captureIncompleteOrders: row?.captureIncompleteOrders ?? true,
    autoConfirmEnabled: row?.autoConfirmEnabled ?? true,
    autoConfirmDelay: row?.autoConfirmDelay ?? 5,
  }
}
