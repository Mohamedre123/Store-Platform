import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { checkoutSettings } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { readWhatsapp } from '@/lib/whatsapp'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { CheckoutSettingsForm, type CheckoutSettingsValues } from './checkout-settings-form'

export const metadata = { title: 'إعدادات الشيك أوت' }

/**
 * أهم شاشة تحكّم في المتجر.
 *
 * الجدول ده موجود من أول يوم و**مكانش ليه صفحة**: بيتكتب بقيم
 * افتراضية لحظة التسجيل والتاجر ما يقدرش يغيّر حرفًا فيه. يعني اللي
 * عايز يشيل خانة البريد عشان تقلّل السلات المتروكة، أو يشغّل رمز
 * التحقّق عشان يقلّل الطلبات الوهمية، مكانش قدامه أي طريق.
 */
export default async function CheckoutSettingsPage() {
  const { store } = await getDashboardContext()

  const [row] = await db
    .select()
    .from(checkoutSettings)
    .where(eq(checkoutSettings.storeId, store.id))
    .limit(1)

  /*
    الصف ممكن ما يكونش موجود.

    بيتعمل مع التسجيل، لكن المتاجر اللي اتعملت قبل ما الجدول يتضاف
    مالهاش صف. القيم دي هي نفس افتراضيات المخطط، والحفظ بيعمل
    `insert … on conflict` فبيتظبط من أول حفظة.
  */
  const whatsapp = await readWhatsapp(store.id)

  const initial: CheckoutSettingsValues = {
    fieldName: row?.fieldName ?? 'required',
    fieldPhone: row?.fieldPhone ?? 'required',
    fieldEmail: row?.fieldEmail ?? 'optional',
    fieldCity: row?.fieldCity ?? 'required',
    fieldArea: row?.fieldArea ?? 'optional',
    fieldStreet: row?.fieldStreet ?? 'required',
    fieldBuilding: row?.fieldBuilding ?? 'optional',
    fieldPostalCode: row?.fieldPostalCode ?? 'hidden',
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
    minOrderEnabled: row?.minOrderEnabled ?? false,
    minOrderAmount: row?.minOrderAmount ?? 0,
    otpEnabled: row?.otpEnabled ?? true,
    captureIncompleteOrders: row?.captureIncompleteOrders ?? true,
    autoConfirmEnabled: row?.autoConfirmEnabled ?? true,
    autoConfirmDelay: row?.autoConfirmDelay ?? 5,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="إعدادات الشيك أوت"
        description="كل خانة زيادة بتقلّل عدد اللي بيكمّلوا الطلب — ظبّط اللي محتاجه بس."
      />

      <Reveal>
        <CheckoutSettingsForm
          initial={initial}
          currency={store.currency}
          whatsappReady={whatsapp.provider !== 'off' && whatsapp.hasKey}
        />
      </Reveal>
    </div>
  )
}
