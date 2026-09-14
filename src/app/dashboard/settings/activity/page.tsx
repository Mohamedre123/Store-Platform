import { ShieldCheck } from 'lucide-react'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { loadActivity } from '@/lib/activity-data'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { ActivityList, type ActivityRow } from './activity-list'

export const metadata = { title: 'سجل النشاط' }
export const dynamic = 'force-dynamic'

export default async function ActivityPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'settings.manage')

  /* البيانات مشتركة مع تطبيق الموبايل (`/api/app/activity`) */
  const items: ActivityRow[] = await loadActivity(store.id)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="سجل النشاط"
        description="مين عمل إيه في اللوحة — الإجراءات اللي بتلمس فلوس أو مخزون أو صلاحيات."
      />

      {items.length === 0 ? (
        <Reveal>
          <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <ShieldCheck className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">مافيش نشاط مسجّل</h2>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              أول ما حد يغيّر حالة طلب أو يحذف منتج أو ينشر المتجر، هيتسجّل هنا
              باسمه ووقته.
            </p>
          </Card>
        </Reveal>
      ) : (
        <Reveal>
          <ActivityList items={items} />
        </Reveal>
      )}
    </div>
  )
}
