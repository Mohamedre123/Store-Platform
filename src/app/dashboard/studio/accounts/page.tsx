import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { availablePlatforms, listAccounts } from '@/lib/social'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { AccountsPanel } from './accounts-panel'

export const metadata = { title: 'حسابات السوشيال' }

/**
 * ربط صفحات التاجر.
 *
 * ## المنصة اللي مش مضبوطة ما بتظهرش
 * `META_APP_ID` أو `TIKTOK_CLIENT_KEY` الناقص معناه إن الربط مش
 * هيشتغل. عرض الزرار وهو بيرجّع خطأ بيخلّي التاجر يجرّب تلات مرات
 * ويفتكر إن حسابه هو المشكلة.
 */
export default async function SocialAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>
}) {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'marketing.manage')

  const [accounts, params] = await Promise.all([listAccounts(store.id), searchParams])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="حسابات السوشيال"
        description="اربط صفحاتك مرة، وبعدها البوستات بتنزل عليها لوحدها."
      />

      <Reveal>
        <AccountsPanel
          accounts={accounts.map((a) => ({
            id: a.id,
            platform: a.platform,
            name: a.name,
            avatar: a.avatar,
            canPublish: a.canPublish,
            provider: a.provider,
            status: a.status,
            lastError: a.lastError,
          }))}
          available={availablePlatforms()}
          connected={params.connected ?? null}
          error={params.error ?? null}
        />
      </Reveal>
    </div>
  )
}
