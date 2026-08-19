import { desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { apiKeys, webhooks } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { ROOT_DOMAIN } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { DevelopersManager, type HookRow, type KeyRow } from './developers-manager'

export const metadata = { title: 'المطوّرون' }

export default async function DevelopersPage() {
  const { store } = await getDashboardContext()

  const [keys, hooks] = await Promise.all([
    db
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        prefix: apiKeys.prefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.storeId, store.id))
      .orderBy(desc(apiKeys.createdAt)),
    db
      .select({
        id: webhooks.id,
        url: webhooks.url,
        events: webhooks.events,
        isActive: webhooks.isActive,
        failureCount: webhooks.failureCount,
        lastDeliveryAt: webhooks.lastDeliveryAt,
      })
      .from(webhooks)
      .where(eq(webhooks.storeId, store.id))
      .orderBy(desc(webhooks.createdAt)),
  ])

  const protocol = ROOT_DOMAIN.startsWith('localhost') ? 'http' : 'https'

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="المطوّرون"
        description="مفاتيح API وويب هوكس لربط متجرك بأي نظام خارجي."
      />

      <Reveal>
        <DevelopersManager
          keys={keys as KeyRow[]}
          hooks={hooks as HookRow[]}
          apiBase={`${protocol}://${ROOT_DOMAIN}`}
        />
      </Reveal>
    </div>
  )
}
