import Link from 'next/link'
import { FileText, Globe, LinkIcon } from 'lucide-react'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { storeThemes } from '@/db/schema'
import { getTheme } from '@/lib/themes'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { ensureAccountId } from '@/lib/account-id'
import { AccountBadge } from '@/components/dashboard/account-badge'
import { readWhatsapp } from '@/lib/whatsapp'
import { WhatsappIcon } from '@/components/storefront/whatsapp-icon'
import { storeUrl } from '@/lib/domain'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { SettingsForm } from './settings-form'

export const metadata = { title: 'الإعدادات' }

export default async function SettingsPage() {
  const { store, user, actor } = await getDashboardContext()
  guard(actor, 'settings.manage')

  /*
    معرّف الحساب هنا كمان لا في صفحة الاشتراك بس.

    التاجر اللي الدعم بيسأله «إيه معرّف حسابك» بيدوّر عليه في
    «الإعدادات» أول حاجة — وده أطبع مكان يتلاقى فيه بيانات حسابه.
  */
  const accountId = await ensureAccountId(user.id, user.publicId)

  /*
    ألوان الهوية بتتقرا من توكنز الثيم مباشرةً — نفس المصدر اللي
    بيقرا منه المتجر. ولو التاجر لسه ما غيّرش حاجة، بنعرض ألوان
    الثيم اللي مختاره بدل خانة فاضية تخلّيه يفتكر إن مفيش لون.
  */
  const [themeRow] = await db
    .select({ slug: storeThemes.themeSlug, tokens: storeThemes.tokens })
    .from(storeThemes)
    .where(eq(storeThemes.storeId, store.id))
    .limit(1)

  const whatsapp = await readWhatsapp(store.id)
  const palette = getTheme(themeRow?.slug ?? '').palette
  const tokens = (themeRow?.tokens ?? {}) as { primary?: string; accent?: string }
  const colors = {
    primary: tokens.primary ?? palette.primary,
    accent: tokens.accent ?? palette.accent,
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الإعدادات"
        description="بيانات متجرك وتفضيلاته."
        action={<AccountBadge accountId={accountId} />}
      />

      <Reveal>
        <SettingsForm store={store} colors={colors} />
      </Reveal>

      {/* صفحات السياسات */}
      <Reveal delay={60}>
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
              <FileText className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold">صفحات المتجر</h2>
              <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
                سياسة الإرجاع والخصوصية والشروط — بتظهر في فوتر متجرك وبتزوّد ثقة العميل.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/settings/pages"
            className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          >
            <FileText className="h-4 w-4" aria-hidden="true" />
            تعديل الصفحات
          </Link>
        </Card>
      </Reveal>

      {/* واتساب — الطريق الوحيد للعميل اللي مساب بريده */}
      <Reveal delay={70}>
        <Card className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#25D366]/12 text-[#25D366]">
              <WhatsappIcon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="font-semibold">واتساب المتجر</h2>
              <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
                رموز الدخول وتأكيد الطلبات وحالة الشحن توصل لعملاءك على واتساب — باسم متجرك ومن
                رقمك.
              </p>
            </div>
          </div>

          <Link
            href="/dashboard/settings/whatsapp"
            className="flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          >
            <WhatsappIcon className="h-4 w-4" />
            {whatsapp.provider === 'off' ? 'اربط واتساب' : 'إدارة الربط'}
          </Link>
        </Card>
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
