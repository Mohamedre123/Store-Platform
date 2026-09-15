import 'server-only'
import type { DashboardContext } from '@/lib/store-context'
import type { OrderSettingsValues } from '@/app/dashboard/settings/orders/order-settings-form'

/**
 * قيم «إعدادات الطلبات» من صف المتجر.
 *
 * صفحة اللوحة ومسار التطبيق (`/api/app/order-settings`) بيقروا من هنا
 * عشان الاتنين يعرضوا نفس القيم بالظبط.
 */
export function orderSettingsValues(store: DashboardContext['store']): OrderSettingsValues {
  return {
    manualOrdersEnabled: store.manualOrdersEnabled,
    manualOversell: store.manualOversell,
    manualCustomPricing: store.manualCustomPricing,
    manualDepositEnabled: store.manualDepositEnabled,
    orderPrefix: store.orderPrefix ?? '',
    orderSuffix: store.orderSuffix ?? '',
    /* `orderSequence` آخر رقم اتصرف — اللي جاي هو اللي بعده */
    nextOrderNumber: store.orderSequence + 1,
  }
}
