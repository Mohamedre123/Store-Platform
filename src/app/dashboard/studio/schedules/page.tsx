import { and, eq, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { categories } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { listSchedules } from '@/lib/content-schedules'
import { listAccounts } from '@/lib/social'
import { resolveEngines } from '@/lib/ai/settings'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { SchedulesManager } from './schedules-manager'
import { searchProductsAction } from '../actions'

export const metadata = { title: 'النشر التلقائي' }

/**
 * جداول النشر.
 *
 * ## دي الميزة الحقيقية
 * التاجر اللي بيفتح الاستوديو ويعمل بوست بإيده بيعمله مرتين وينسى.
 * والصفحة اللي بتنزل مرة في الأسبوع ما بتبنيش متابعين. الجدولة هي
 * اللي بتحوّل الأداة من لعبة لقناة تسويق شغّالة.
 */
export default async function SchedulesPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'marketing.manage')

  const [schedules, accounts, cats, products, engines] = await Promise.all([
    listSchedules(store.id),
    listAccounts(store.id),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(and(eq(categories.storeId, store.id), eq(categories.isActive, true)))
      .limit(100),
    searchProductsAction(''),
    resolveEngines(store.id, 'tools'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="النشر التلقائي"
        description="قوله كل يوم الساعة كام — وهو بيعمل البوست وينشره لوحده."
      />

      <Reveal>
        <SchedulesManager
          storeTimezone={store.timezone}
          providers={engines.ok ? engines.available : []}
          schedules={schedules.map((s) => ({
            ...s,
            lastRunAt: s.lastRunAt ? s.lastRunAt.toISOString() : null,
            nextRunAt: s.nextRunAt ? s.nextRunAt.toISOString() : null,
          }))}
          accounts={accounts
            .filter((a) => a.status === 'active')
            .map((a) => ({ id: a.id, name: a.name, platform: a.platform }))}
          categories={cats}
          products={products}
        />
      </Reveal>
    </div>
  )
}
