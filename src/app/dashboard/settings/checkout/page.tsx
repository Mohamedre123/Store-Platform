import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { readWhatsapp } from '@/lib/whatsapp'
import { loadCheckoutSettings } from '@/lib/checkout-settings-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { CheckoutSettingsForm } from './checkout-settings-form'
import { listPickerCategories } from '../../storefront/picker-actions'

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
  const { store, actor } = await getDashboardContext()
  guard(actor, 'settings.manage')

  /* القيم (بافتراضيات المخطط لو الصف مش موجود) — نفس اللي مسار التطبيق بيقراه */
  const initial = await loadCheckoutSettings(store.id)
  const whatsapp = await readWhatsapp(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="إعدادات الشيك أوت"
        description="كل خانة زيادة بتقلّل عدد اللي بيكمّلوا الطلب — ظبّط اللي محتاجه بس."
      />

      <Reveal>
        <CheckoutSettingsForm
          initial={initial}
          pickerCategories={await listPickerCategories()}
          currency={store.currency}
          whatsappReady={whatsapp.provider !== 'off' && whatsapp.hasKey}
          storeWhatsapp={store.whatsapp}
        />
      </Reveal>
    </div>
  )
}
