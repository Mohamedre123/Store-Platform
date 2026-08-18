import Link from 'next/link'
import { Globe, LinkIcon } from 'lucide-react'
import { getDashboardContext } from '@/lib/store-context'
import { storeUrl } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { SettingsForm } from './settings-form'

export const metadata = { title: 'الإعدادات' }

export default async function SettingsPage() {
  const { store } = await getDashboardContext()

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="الإعدادات" description="بيانات متجرك وتفضيلاته." />

      <Reveal>
        <SettingsForm store={store} />
      </Reveal>

      {/* النطاق — صفحته مستقلة لأن فيها خطوات DNS */}
      <Reveal delay={80}>
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <Globe className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold">نطاق المتجر</h2>
              <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
                {store.customDomain ? (
                  <>
                    نطاقك:{' '}
                    <bdi dir="ltr" className="font-medium">
                      {store.customDomain}
                    </bdi>
                    {!store.customDomainVerifiedAt && (
                      <span className="text-[var(--color-warning)]"> — لسه مش متحقَّق منه</span>
                    )}
                  </>
                ) : (
                  <>
                    عنوان متجرك الحالي:{' '}
                    <bdi dir="ltr" className="font-medium">
                      {storeUrl(store.slug).replace(/^https?:\/\//, '')}
                    </bdi>
                  </>
                )}
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/settings/domain"
            className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          >
            <LinkIcon className="h-4 w-4" aria-hidden="true" />
            {store.customDomain ? 'إدارة النطاق' : 'اربط نطاقك الخاص'}
          </Link>
        </Card>
      </Reveal>
    </div>
  )
}
