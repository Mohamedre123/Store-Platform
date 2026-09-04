import { getDashboardContext } from '@/lib/store-context'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { OrderSettingsForm } from './order-settings-form'

export const metadata = { title: 'إعدادات الطلبات' }

export default async function OrderSettingsPage() {
  const { store } = await getDashboardContext()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="إعدادات الطلبات"
        description="تسجيل الطلبات بإيدك، وشكل رقم الطلب، والقيود اللي تفكّها لموظفينك."
      />

      <Reveal>
        <OrderSettingsForm
          initial={{
            manualOrdersEnabled: store.manualOrdersEnabled,
            manualOversell: store.manualOversell,
            manualCustomPricing: store.manualCustomPricing,
            manualDepositEnabled: store.manualDepositEnabled,
            orderPrefix: store.orderPrefix ?? '',
            orderSuffix: store.orderSuffix ?? '',
            /* `orderSequence` آخر رقم اتصرف — اللي جاي هو اللي بعده */
            nextOrderNumber: store.orderSequence + 1,
          }}
        />
      </Reveal>
    </div>
  )
}
