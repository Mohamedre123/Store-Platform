import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { publicStoreUrl } from '@/lib/domain'
import { seoValues } from '@/lib/seo-data'
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
          initial={seoValues(store)}
        />
      </Reveal>
    </div>
  )
}
