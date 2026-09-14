import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadBanners } from '@/lib/banners-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { BannersManager, type BannerRow } from './banners-manager'

export const metadata = { title: 'البانرات' }

export default async function BannersPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'storefront.manage')

  /* الاستعلام في `src/lib/banners-data.ts` — تطبيق الموبايل بيقرا نفس البانرات */
  const rows = await loadBanners(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="البانرات"
        description="شرائط ترويجية بتظهر في متجرك — وبتختفي لوحدها لما العرض ينتهي."
      />

      <Reveal>
        <BannersManager banners={rows as BannerRow[]} />
      </Reveal>
    </div>
  )
}
