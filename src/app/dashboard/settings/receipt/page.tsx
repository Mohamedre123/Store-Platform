import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadReceipt } from '@/lib/receipt-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { ReceiptForm } from './receipt-form'

export const metadata = { title: 'صفحة الطلب والإيصال' }

export default async function ReceiptSettingsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'settings.manage')

  /* نفس افتراضيات المخطط — والحفظ بيعمل الصف لو مش موجود */
  const { values: initial, hasWhatsapp, hasTelegram } = await loadReceipt(store)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="صفحة الطلب والإيصال"
        description="أكتر صفحة العميل بيفتحها بعد ما يشتري — وكل حاجة فيها إما بتطمّنه أو بتخلّيه يتصل بيك."
      />

      <Reveal>
        <ReceiptForm
          initial={initial}
          hasWhatsapp={hasWhatsapp}
          hasTelegram={hasTelegram}
        />
      </Reveal>
    </div>
  )
}
