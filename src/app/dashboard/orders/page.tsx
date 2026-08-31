import Link from 'next/link'
import { and, count, desc, eq, ne } from 'drizzle-orm'
import { Mail, MessageCircle, Package, Phone, ShoppingBag } from 'lucide-react'
import { db } from '@/db'
import { orders } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { formatMoney, formatDateTime } from '@/lib/utils'
import { ORDER_STATUSES, statusMeta } from '@/lib/order-status'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal, SpotlightCard } from '@/components/motion'
import { TrustBadge } from '@/components/dashboard/trust-badge'
import { loadTrustScores } from '@/lib/trust-score'
import { Card } from '@/components/ui'
import { cn } from '@/lib/utils'

export const metadata = { title: 'الطلبات' }

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { store } = await getDashboardContext()
  const { filter } = await searchParams

  const isIncomplete = filter === 'incomplete'
  const where = isIncomplete
    ? and(eq(orders.storeId, store.id), eq(orders.isIncomplete, true))
    : filter && filter !== 'all'
      ? and(eq(orders.storeId, store.id), eq(orders.status, filter as never))
      : and(eq(orders.storeId, store.id), eq(orders.isIncomplete, false))

  const [rows, counts] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        isIncomplete: orders.isIncomplete,
        customerName: orders.customerName,
        customerPhone: orders.customerPhone,
        customerEmail: orders.customerEmail,
        total: orders.total,
        createdAt: orders.createdAt,
        shippingAddress: orders.shippingAddress,
      })
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(100),

    db
      .select({ status: orders.status, isIncomplete: orders.isIncomplete, n: count() })
      .from(orders)
      .where(eq(orders.storeId, store.id))
      .groupBy(orders.status, orders.isIncomplete),
  ])

  /*
    درجات الثقة لكل أرقام الصفحة في استعلامين.

    التاجر بيمسح القايمة بعينه قبل ما يقرّر يشحن إيه — فالتحذير
    لازم يبقى هنا، مش جوّه كل طلب على حدة.
  */
  const trust = await loadTrustScores(
    store.id,
    rows.map((r) => r.customerPhone),
  )

  const incompleteCount = counts.find((c) => c.isIncomplete)?.n ?? 0
  const totalCount = counts.filter((c) => !c.isIncomplete).reduce((n, c) => n + c.n, 0)
  const countFor = (key: string) => counts.find((c) => !c.isIncomplete && c.status === key)?.n ?? 0

  const tabs = [
    { key: 'all', label: 'الكل', n: totalCount },
    ...ORDER_STATUSES.filter((s) => !['incomplete', 'returned'].includes(s.key)).map((s) => ({
      key: s.key,
      label: s.label,
      n: countFor(s.key),
    })),
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الطلبات"
        description={`${totalCount} طلب${incompleteCount ? ` · ${incompleteCount} سلة متروكة` : ''}`}
      />

      {/* السلات المتروكة — أول حاجة تشوفها لأنها فلوس على وشك تضيع */}
      {incompleteCount > 0 && !isIncomplete && (
        <Reveal>
          <Link href="/dashboard/orders?filter=incomplete" className="block">
            <Card className="flex items-center gap-3 border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4 transition-opacity hover:opacity-90">
              <ShoppingBag className="h-5 w-5 shrink-0 text-[var(--color-warning)]" aria-hidden="true" />
              <span className="flex-1 text-sm">
                <span className="font-semibold text-[var(--color-warning)]">
                  {incompleteCount} عميل كتب رقمه وما كمّلش الطلب
                </span>
                <span className="mt-0.5 block text-[var(--fg-muted)]">
                  كلّمهم على واتساب — دي أسرع فلوس ممكن ترجّعها
                </span>
              </span>
            </Card>
          </Link>
        </Reveal>
      )}

      {/* التبويبات */}
      <Reveal delay={60}>
        <div className="scroll-x -mx-1 flex gap-2 px-1 pb-1">
          {tabs.map((t) => {
            const active = (filter ?? 'all') === t.key && !isIncomplete
            return (
              <Link
                key={t.key}
                href={t.key === 'all' ? '/dashboard/orders' : `/dashboard/orders?filter=${t.key}`}
                className={cn(
                  'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
                  active
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
                )}
              >
                {t.label}
                {t.n > 0 && <span className="tabular ms-1.5 opacity-60">{t.n}</span>}
              </Link>
            )
          })}
          <Link
            href="/dashboard/orders?filter=incomplete"
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              isIncomplete
                ? 'border-[var(--color-warning)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
                : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
            )}
          >
            سلات متروكة
            {incompleteCount > 0 && <span className="tabular ms-1.5 opacity-60">{incompleteCount}</span>}
          </Link>
        </div>
      </Reveal>

      {rows.length === 0 ? (
        <Reveal delay={100}>
          <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Package className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">
              {isIncomplete ? 'مافيش سلات متروكة' : 'مافيش طلبات هنا'}
            </h2>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              {isIncomplete
                ? 'لما عميل يكتب رقمه في الشيك أوت ويسيب الطلب، هيظهر هنا.'
                : 'أول ما يجيلك طلب هيظهر في الصفحة دي على طول.'}
            </p>
          </Card>
        </Reveal>
      ) : (
        <div className="flex flex-col gap-2.5">
          {rows.map((o, i) => {
            const meta = statusMeta(o.isIncomplete ? 'incomplete' : o.status)
            const city = (o.shippingAddress as { city?: string } | null)?.city

            return (
              <Reveal key={o.id} delay={Math.min(i, 6) * 40}>
                <SpotlightCard className="rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4">
                    <Link href={`/dashboard/orders/${o.id}`} className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="tabular font-bold">#{o.orderNumber}</span>
                        <span
                          className="rounded-md px-2 py-0.5 text-xs font-medium"
                          style={{ background: meta.bg, color: meta.fg }}
                        >
                          {meta.label}
                        </span>
                        {o.customerPhone && trust.has(o.customerPhone) && (
                          <TrustBadge trust={trust.get(o.customerPhone)!} compact />
                        )}
                      </span>
                      <span className="mt-1 block truncate text-sm text-[var(--fg-muted)]">
                        {o.customerName || 'بدون اسم'}
                        {city && ` · ${city}`}
                      </span>
                      {/*
                        وسيلة التواصل في السطر نفسه — مش جوّه الطلب.

                        السلة المتروكة بالذات بتتراجع من القايمة دي على
                        طول: التاجر بيمرّ على العشرين سطر ويقرّر يكلّم
                        مين. لو البريد مخفي جوّه، هو عمليًا مش موجود،
                        وبيفضل يبعت واتساب لواحد ما بيردّش.
                      */}
                      {(o.customerPhone || o.customerEmail) && (
                        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-[var(--fg-subtle)]">
                          {o.customerPhone && <bdi dir="ltr">{o.customerPhone}</bdi>}
                          {o.customerPhone && o.customerEmail && <span aria-hidden="true">·</span>}
                          {o.customerEmail && (
                            <bdi dir="ltr" className="min-w-0 truncate">
                              {o.customerEmail}
                            </bdi>
                          )}
                        </span>
                      )}
                      <span className="mt-0.5 block text-xs text-[var(--fg-subtle)]">
                        {formatDateTime(o.createdAt)}
                      </span>
                    </Link>

                    <span className="tabular text-lg font-bold">
                      {formatMoney(o.total, store.currency)}
                    </span>

                    {(o.customerPhone || o.customerEmail) && (
                      <div className="flex gap-1">
                        {o.customerEmail && (
                          <a
                            href={`mailto:${o.customerEmail}`}
                            aria-label="بريد"
                            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
                          >
                            <Mail className="h-4 w-4" aria-hidden="true" />
                          </a>
                        )}
                        {o.customerPhone && (
                          <>
                        <a
                          href={`tel:${o.customerPhone}`}
                          aria-label="اتصال"
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
                        >
                          <Phone className="h-4 w-4" aria-hidden="true" />
                        </a>
                        <a
                          href={`https://wa.me/${o.customerPhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                            o.isIncomplete
                              ? `مرحبًا${o.customerName ? ' ' + o.customerName : ''}، شفنا إنك كنت بتطلب من ${store.name} وما كمّلتش. تحب نساعدك؟`
                              : `مرحبًا${o.customerName ? ' ' + o.customerName : ''}، بخصوص طلبك رقم ${o.orderNumber} من ${store.name}`,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="واتساب"
                          className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border-strong)] text-[var(--color-success)] transition-colors hover:bg-[var(--color-success-soft)]"
                        >
                          <MessageCircle className="h-4 w-4" aria-hidden="true" />
                        </a>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </SpotlightCard>
              </Reveal>
            )
          })}
        </div>
      )}
    </div>
  )
}
