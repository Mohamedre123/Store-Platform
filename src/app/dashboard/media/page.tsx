import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { listMedia, syncFromStorage, usageFor } from '@/lib/media'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { MediaManager, type MediaRow } from './media-manager'

export const metadata = { title: 'معرض الوسائط' }

export default async function MediaPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'storefront.manage')

  /**
   * المزامنة قبل القراءة.
   *
   * الملفات اللي اترفعت قبل ما المكتبة تتعمل مالهاش صفوف — وهي بالظبط
   * صور تاجر شغّال من شهور. من غير السطر ده، أنشط التجّار بيفتحوا
   * المعرض ويلاقوه فاضي، وده أسوأ انطباع أول ممكن.
   *
   * بتتنفّذ على كل فتحة، وبترجّع صفر بعد أول مرة: بتقرا التخزين
   * وتقارن بالموجود وما بتكتبش غير الناقص.
   */
  const synced = await syncFromStorage(store.id)

  const rows = await listMedia(store.id)
  const usage = await usageFor(
    store.id,
    rows.map((r) => r.url),
  )

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="معرض الوسائط"
        description="كل صورة رفعتها في مكان واحد — استعملها تاني من غير ما ترفعها مرتين."
      />

      <Reveal>
        <MediaManager
          synced={synced}
          rows={rows.map(
            (r): MediaRow => ({
              id: r.id,
              url: r.url,
              name: r.name,
              folder: r.folder,
              sizeBytes: r.sizeBytes,
              createdAt: r.createdAt,
              usedIn: usage.get(r.url)?.productImages ?? 0,
            }),
          )}
        />
      </Reveal>
    </div>
  )
}
