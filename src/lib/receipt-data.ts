import 'server-only'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { thankYouSettings } from '@/db/schema'
import type { ActiveStore } from '@/lib/store-context'
import { getStoreTheme } from '@/lib/storefront'
import type { ReceiptValues } from '@/app/dashboard/settings/receipt/receipt-form'

/**
 * إعدادات صفحة الطلب والإيصال — صفحة اللوحة ومسار التطبيق (`/api/app/receipt`) بيقروا من هنا.
 * نفس افتراضيات المخطط لو الصف مش موجود، والحفظ بيعمل الصف.
 */
export async function loadReceipt(store: ActiveStore) {
  const [[row], theme] = await Promise.all([
    db.select().from(thankYouSettings).where(eq(thankYouSettings.storeId, store.id)).limit(1),
    getStoreTheme(store.id),
  ])

  const values: ReceiptValues = {
    showOrderSummary: row?.showOrderSummary ?? true,
    showProgressTracker: row?.showProgressTracker ?? true,
    showWhatsappButton: row?.showWhatsappButton ?? true,
    showTelegramButton: row?.showTelegramButton ?? false,
    allowDownloadReceipt: row?.allowDownloadReceipt ?? true,
    customMessage: row?.customMessage ?? '',
  }

  return {
    values,
    /* رقم واتساب المتجر — الزرار من غيره بيودّي على رابط مكسور */
    hasWhatsapp: Boolean(store.whatsapp),
    /* تيليجرام مفعّل في شريط الأدوات؟ نفس الحساب، مصدر واحد */
    hasTelegram: Boolean(theme.custom.toolbar.telegramEnabled && theme.custom.toolbar.telegramUsername?.trim()),
  }
}
