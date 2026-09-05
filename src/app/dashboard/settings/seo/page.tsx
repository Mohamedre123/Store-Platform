import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { publicStoreUrl } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { SeoForm } from './seo-form'

export const metadata = { title: 'الظهور والسيو' }

export default async function SeoPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'settings.manage')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الظهور والسيو"
        description="شكل متجرك في جوجل وعلى واتساب، وقفله مؤقتًا وإنت بتجهّز."
      />

      <Reveal>
        <SeoForm
          storeName={store.name}
          storeUrl={publicStoreUrl(store)}
          initial={{
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
          }}
        />
      </Reveal>
    </div>
  )
}
