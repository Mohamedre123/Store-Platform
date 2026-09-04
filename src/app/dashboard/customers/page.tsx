import Link from 'next/link'
import { and, desc, eq, sql } from 'drizzle-orm'
import { MessageCircle, Phone, Users } from 'lucide-react'
import { db } from '@/db'
import { customers } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { formatMoney, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal, SpotlightCard } from '@/components/motion'
import { Card } from '@/components/ui'

export const metadata = { title: 'العملاء' }

const TIERS: Record<string, { label: string; bg: string; fg: string }> = {
  bronze: { label: 'برونزي', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
  silver: { label: 'فضي', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
  gold: { label: 'ذهبي', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  platinum: { label: 'بلاتيني', bg: 'var(--primary-soft)', fg: 'var(--primary)' },
}

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'customers.view')

  const { filter } = await searchParams

  /**
   * المشتركون = عملاء موافقين ومعاهم بريد.
   *
   * ## ليه فلتر مش صفحة لوحدها
   * اشتراك النشرة عندنا بيكتب في **جدول عملاء التاجر** لا في قايمة
   * منفصلة، عشان اللي سجّل بريده وبعدين طلب يبقى شخصًا واحدًا. قايمة
   * منفصلة كانت هتخلّي التاجر يبعت نفس الحملة لنفس الشخص مرتين
   * ويحسبه اتنين في أرقامه.
   *
   * فالمشتركون مش كيان تاني — هم نفس العملاء بعدسة تانية.
   */
  const subscribersOnly = filter === 'subscribers'

  const where = subscribersOnly
    ? and(
        eq(customers.storeId, store.id),
        eq(customers.acceptsMarketing, true),
        sql`${customers.email} is not null and ${customers.email} <> ''`,
      )
    : eq(customers.storeId, store.id)

  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      ordersCount: customers.ordersCount,
      totalSpent: customers.totalSpent,
      lastOrderAt: customers.lastOrderAt,
      tier: customers.tier,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(where)
    .orderBy(desc(customers.totalSpent), desc(customers.createdAt))
    .limit(200)

  const [totals] = await db
    .select({
      count: sql<number>`count(*)::int`,
      revenue: sql<number>`coalesce(sum(${customers.totalSpent}), 0)::int`,
      repeat: sql<number>`count(*) filter (where ${customers.ordersCount} > 1)::int`,
      /* المشتركون بنفس شرط الحملات بالحرف — رقمين مختلفين بيضيّعوا الثقة */
      subscribers: sql<number>`count(*) filter (
        where ${customers.acceptsMarketing} = true
          and ${customers.email} is not null
          and ${customers.email} <> ''
      )::int`,
    })
    .from(customers)
    .where(eq(customers.storeId, store.id))

  /**
   * متوسط ما ينفقه العميل — رقم بيوجّه قرارات التاجر أكتر من العدد
   * المجرّد. عميل بينفق ٥٠٠ مرة واحدة غير عميل بينفق ٢٠٠ ثلاث مرات.
   */
  const average = totals.count > 0 ? Math.round(totals.revenue / totals.count) : 0
  const repeatRate = totals.count > 0 ? Math.round((totals.repeat / totals.count) * 100) : 0

  const stats = [
    { label: 'إجمالي العملاء', value: String(totals.count) },
    { label: 'متوسط إنفاق العميل', value: formatMoney(average, store.currency) },
    { label: 'عملاء اشتروا أكتر من مرة', value: `${repeatRate}%` },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={subscribersOnly ? 'المشتركون' : 'العملاء'}
        description={
          subscribersOnly
            ? `${totals.subscribers} عميل موافق يستقبل رسايلك التسويقية`
            : `${totals.count} عميل سجّلوا طلبات في متجرك`
        }
      />

      {/* تبويبان لا صفحتان — نفس البيانات بعدستين */}
      <Reveal>
        <div className="flex gap-2">
          {[
            { key: 'all', label: 'كل العملاء', n: totals.count },
            { key: 'subscribers', label: 'المشتركون', n: totals.subscribers },
          ].map((t) => {
            const active = t.key === 'subscribers' ? subscribersOnly : !subscribersOnly
            return (
              <Link
                key={t.key}
                href={t.key === 'all' ? '/dashboard/customers' : '/dashboard/customers?filter=subscribers'}
                className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]'
                }`}
              >
                {t.label}
                <span className="tabular ms-1.5 opacity-60">{t.n}</span>
              </Link>
            )
          })}
        </div>
      </Reveal>

      {rows.length === 0 ? (
        <Reveal>
          <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Users className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">لسه مافيش عملاء</h2>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              أول ما يجيلك طلب، بيانات صاحبه هتتسجّل هنا تلقائيًا.
            </p>
          </Card>
        </Reveal>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 60}>
                <Card className="flex flex-col gap-1 p-4">
                  <span className="text-xs text-[var(--fg-muted)]">{s.label}</span>
                  <span className="tabular text-xl font-bold tracking-tight">{s.value}</span>
                </Card>
              </Reveal>
            ))}
          </div>

          <div className="flex flex-col gap-2.5">
            {rows.map((c, i) => {
              const tier = TIERS[c.tier] ?? TIERS.bronze
              return (
                <Reveal key={c.id} delay={Math.min(i, 6) * 40}>
                  <SpotlightCard className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">{c.name || 'بدون اسم'}</span>
                          {c.ordersCount > 1 && (
                            <span
                              className="rounded-md px-2 py-0.5 text-xs font-medium"
                              style={{ background: tier.bg, color: tier.fg }}
                            >
                              {tier.label}
                            </span>
                          )}
                        </div>
                        {c.phone && (
                          <bdi dir="ltr" className="mt-0.5 block text-start text-sm text-[var(--fg-muted)]">
                            {c.phone}
                          </bdi>
                        )}
                        <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
                          {c.lastOrderAt ? `آخر طلب ${formatDate(c.lastOrderAt)}` : 'ما طلبش لسه'}
                        </span>
                      </div>

                      <div className="text-end">
                        <span className="tabular block font-bold">
                          {formatMoney(c.totalSpent, store.currency)}
                        </span>
                        <span className="tabular block text-xs text-[var(--fg-subtle)]">
                          {c.ordersCount} طلب
                        </span>
                      </div>

                      {c.phone && (
                        <div className="flex gap-1">
                          <a
                            href={`tel:${c.phone}`}
                            aria-label="اتصال"
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
                          >
                            <Phone className="h-4 w-4" aria-hidden="true" />
                          </a>
                          <a
                            href={`https://wa.me/${c.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                              `مرحبًا${c.name ? ' ' + c.name : ''}، معاك ${store.name}`,
                            )}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="واتساب"
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--color-success)] transition-colors hover:bg-[var(--color-success-soft)]"
                          >
                            <MessageCircle className="h-4 w-4" aria-hidden="true" />
                          </a>
                        </div>
                      )}
                    </div>
                  </SpotlightCard>
                </Reveal>
              )
            })}
          </div>

          <Reveal>
            <p className="text-sm text-[var(--fg-subtle)]">
              العملاء مرتّبين حسب إجمالي إنفاقهم — الأعلى فوق.{' '}
              <Link href="/dashboard/orders" className="font-medium text-[var(--primary)] hover:underline">
                شوف الطلبات
              </Link>
            </p>
          </Reveal>
        </>
      )}
    </div>
  )
}
