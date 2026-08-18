import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { storePlugins } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { PluginsManager, type PluginRow } from './plugins-manager'

export const metadata = { title: 'الإضافات' }

export default async function PluginsPage() {
  const { store } = await getDashboardContext()

  const rows = await db
    .select({
      slug: storePlugins.pluginSlug,
      enabled: storePlugins.enabled,
      config: storePlugins.config,
    })
    .from(storePlugins)
    .where(eq(storePlugins.storeId, store.id))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الإضافات"
        description="اربط أدوات القياس بمتجرك. الصق المعرّف وفعّل — الكود بيتحط في متجرك تلقائيًا."
      />

      <Reveal>
        <PluginsManager installed={rows as PluginRow[]} />
      </Reveal>
    </div>
  )
}
