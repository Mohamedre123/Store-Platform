import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { thankYouSettings } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { getStoreTheme } from '@/lib/storefront'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { ReceiptForm, type ReceiptValues } from './receipt-form'

export const metadata = { title: 'صفحة الطلب والإيصال' }

export default async function ReceiptSettingsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'settings.manage')

  const [[row], theme] = await Promise.all([
    db
      .select()
      .from(thankYouSettings)
      .where(eq(thankYouSettings.storeId, store.id))
      .limit(1),
    getStoreTheme(store.id),
  ])

  /* نفس افتراضيات المخطط — والحفظ بيعمل الصف لو مش موجود */
  const initial: ReceiptValues = {
    showOrderSummary: row?.showOrderSummary ?? true,
    showProgressTracker: row?.showProgressTracker ?? true,
    showWhatsappButton: row?.showWhatsappButton ?? true,
    showTelegramButton: row?.showTelegramButton ?? false,
    allowDownloadReceipt: row?.allowDownloadReceipt ?? true,
    customMessage: row?.customMessage ?? '',
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="صفحة الطلب والإيصال"
        description="أكتر صفحة العميل بيفتحها بعد ما يشتري — وكل حاجة فيها إما بتطمّنه أو بتخلّيه يتصل بيك."
      />

      <Reveal>
        <ReceiptForm
          initial={initial}
          hasWhatsapp={Boolean(store.whatsapp)}
          hasTelegram={Boolean(
            theme.custom.toolbar.telegramEnabled && theme.custom.toolbar.telegramUsername?.trim(),
          )}
        />
      </Reveal>
    </div>
  )
}
