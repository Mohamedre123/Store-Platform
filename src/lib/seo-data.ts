import 'server-only'
import type { ActiveStore } from '@/lib/store-context'
import type { SeoValues } from '@/app/dashboard/settings/seo/seo-form'

/** قيم «الظهور والسيو» من صف المتجر — صفحة اللوحة ومسار التطبيق (`/api/app/seo`) بيقروا من هنا */
export function seoValues(store: ActiveStore): SeoValues {
  return {
    seoTitle: store.seoTitle ?? '',
    seoDescription: store.seoDescription ?? '',
    seoKeywords: store.seoKeywords ?? '',
    ogImage: store.ogImage ?? '',
    ogTitle: store.ogTitle ?? '',
    ogDescription: store.ogDescription ?? '',
    headHtml: store.headHtml ?? '',
    allowIndexing: store.allowIndexing,
    hideOutOfStock: store.hideOutOfStock,
    maintenanceMode: store.maintenanceMode,
    maintenanceMessage: store.maintenanceMessage ?? '',
    comingSoon: store.comingSoon,
    comingSoonMessage: store.comingSoonMessage ?? '',
  }
}
