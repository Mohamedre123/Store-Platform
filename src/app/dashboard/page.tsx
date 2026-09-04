import Link from 'next/link'
import Image from 'next/image'
import { and, count, desc, eq, gte, sum } from 'drizzle-orm'
import {
  ArrowLeft,
  CreditCard,
  ImageIcon,
  Package,
  Palette,
  Plus,
  ShoppingBag,
  Truck,
  Users,
} from 'lucide-react'
import { db } from '@/db'
import {
  customers,
  orderItems,
  orders,
  paymentMethods,
  products,
  shippingZones,
} from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { publicStoreUrl } from '@/lib/domain'
import { formatMoney, formatBps } from '@/lib/utils'
import { ORDER_STATUSES } from '@/lib/order-status'
import { getEntitlements, getOrderQuota } from '@/lib/entitlements'
import { loadDashboardStats, pctChange } from '@/lib/dashboard-stats'
import { formatOrderNumber } from '@/lib/order-number'
import { getPlan } from '@/lib/plans'
import { Card } from '@/components/ui'
import { Rail } from '@/components/rail'
import { Reveal } from '@/components/motion'
import { PublishBanner } from './publish-banner'
import { QuotaBanner } from './quota-banner'
import { Greeting } from './greeting'
import { SetupGuide, type SetupStep } from './setup-guide'
import { PlanCard } from './plan-card'
import { StatTiles, type StatTile } from './stat-tiles'
import { OverviewChart, type OverviewSeries } from './overview-chart'

export const metadata = { title: 'لوحة التحكم' }

export default async function DashboardHome() {
  const { store } = await getDashboardContext()
  /* آخر تلاتين يوم — نافذة «الأكتر مبيعًا» */
  const last30 = new Date(Date.now() - 30 * 24 * 3600_000)

  /*
    حالة الاشتراك في أول الصفحة.

    الحد اللي بيوقف الطلبات لازم يوصل للتاجر **قبل** ما يقف — لو
    اكتشفه لما عميل قاله «مش عارف أطلب»، الرسالة وصلت متأخرة يوم
    كامل من البيع.
  */
  const ent = await getEntitlements(store)
  const quota = await getOrderQuota(store)

  /*
    كل حاجة في دفعة واحدة متوازية.

    الصفحة دي بيفتحها التاجر كل صباح، وأي استعلام متتالي بيتحوّل
    لثانية إضافية بيقعد يبصّ فيها على شاشة فاضية.
  */
  const [stats, [pending], [incomplete], [productCount], [customerCount], [hasPayment], [hasShipping]] =
    await Promise.all([
      loadDashboardStats(store.id),
      db
        .select({ n: count() })
        .from(orders)
        .where(and(eq(orders.storeId, store.id), eq(orders.status, 'pending'))),
      db
        .select({ n: count() })
        .from(orders)
        .where(and(eq(orders.storeId, store.id), eq(orders.isIncomplete, true))),
      db
        .select({ n: count() })
        .from(products)
        .where(and(eq(products.storeId, store.id), eq(products.status, 'active'))),
      db.select({ n: count() }).from(customers).where(eq(customers.storeId, store.id)),
      db
        .select({ n: count() })
        .from(paymentMethods)
        .where(and(eq(paymentMethods.storeId, store.id), eq(paymentMethods.enabled, true))),
      db
        .select({ n: count() })
        .from(shippingZones)
        .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.enabled, true))),
    ])

  const [latestOrders, topProducts] = await Promise.all([
    db
      .select({
        id: orders.id,
        number: orders.orderNumber,
        name: orders.customerName,
        total: orders.total,
        status: orders.status,
      })
      .from(orders)
      .where(and(eq(orders.storeId, store.id), eq(orders.isIncomplete, false)))
      .orderBy(desc(orders.createdAt))
      .limit(5),
    db
      .select({
        productId: orderItems.productId,
        name: orderItems.name,
        image: orderItems.image,
        sold: sum(orderItems.quantity),
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(
        and(
          eq(orderItems.storeId, store.id),
          eq(orders.isIncomplete, false),
          gte(orders.createdAt, last30),
        ),
      )
      .groupBy(orderItems.productId, orderItems.name, orderItems.image)
      .orderBy(desc(sum(orderItems.quantity)))
      .limit(5),
  ])

  const { current, previous, series } = stats

  const tiles: StatTile[] = [
    {
      label: 'الزيارات · ١٤ يوم',
      value: String(current.sessions),
      change: pctChange(current.sessions, previous.sessions),
      spark: series.map((d) => d.sessions),
      href: '/dashboard/analytics',
    },
    {
      label: 'المبيعات · ١٤ يوم',
      value: formatMoney(current.revenue, store.currency),
      change: pctChange(current.revenue, previous.revenue),
      spark: series.map((d) => d.revenue),
      href: '/dashboard/analytics',
    },
    {
      label: 'الطلبات · ١٤ يوم',
      value: String(current.orders),
      change: pctChange(current.orders, previous.orders),
      spark: series.map((d) => d.orders),
      href: '/dashboard/orders',
    },
    {
      label: 'معدل التحويل',
      value: formatBps(current.conversionBps),
      change: pctChange(current.conversionBps, previous.conversionBps),
      spark: series.map((d) => d.conversion),
      href: '/dashboard/analytics',
    },
  ]

  /**
   * خطوات التجهيز — بترتيب الاحتياج لا بترتيب الشاشات.
   *
   * من غير منتج مفيش حاجة تتشحن، ومن غير شحن مفيش سعر يتحسب،
   * ومن غير دفع الطلب ما بيقفلش. والنشر آخر خطوة لأنه بيفتح الباب
   * للعملاء — وفتحه قبل ما الباقي يجهز بيوصّل زائرًا لمتجر ناقص.
   */
  const setup: SetupStep[] = [
    {
      key: 'product',
      label: 'ضيف أول منتج',
      hint: 'من غير منتج مفيش حاجة تتباع',
      href: '/dashboard/products/new',
      done: (productCount?.n ?? 0) > 0,
      icon: Package,
    },
    {
      key: 'logo',
      label: 'ارفع شعار متجرك',
      hint: 'بيظهر في الهيدر والفاتورة ورسايل العملاء',
      href: '/dashboard/settings',
      done: Boolean(store.logoLight),
      icon: Palette,
    },
    {
      key: 'shipping',
      label: 'ظبّط مناطق الشحن',
      hint: 'السعر اللي العميل بيشوفه في الشيك أوت',
      href: '/dashboard/shipping',
      done: (hasShipping?.n ?? 0) > 0,
      icon: Truck,
    },
    {
      key: 'payment',
      label: 'فعّل طريقة دفع',
      hint: 'الدفع عند الاستلام أو بوابة بمفاتيحك',
      href: '/dashboard/payments',
      done: (hasPayment?.n ?? 0) > 0,
      icon: CreditCard,
    },
    {
      key: 'theme',
      label: 'اختار شكل متجرك',
      hint: 'الألوان والخطوط والصفحة الرئيسية',
      href: '/dashboard/storefront',
      done: Boolean(store.logoLight) && (productCount?.n ?? 0) > 0,
      icon: ImageIcon,
    },
    {
      key: 'publish',
      label: 'انشر المتجر',
      hint: 'آخر خطوة — بعدها العملاء يقدروا يطلبوا',
      href: '/dashboard/settings',
      done: store.isPublished,
      icon: ShoppingBag,
    },
  ]

  const plan = ent.plan ?? getPlan(store.plan)

  return (
    <div className="flex flex-col gap-8">
      {!ent.active && (
        <Reveal>
          <QuotaBanner
            used={quota.used}
            limit={quota.limit}
            blocked={quota.blocked}
            expired={ent.expired}
          />
        </Reveal>
      )}

      {ent.active && ent.onTrial && ent.daysLeft !== null && ent.daysLeft <= 2 && (
        <Reveal>
          <QuotaBanner used={quota.used} limit={null} blocked={false} trialDaysLeft={ent.daysLeft} />
        </Reveal>
      )}

      <Reveal>
        <PublishBanner initialPublished={store.isPublished} storeUrl={publicStoreUrl(store)} />
      </Reveal>

      <Reveal>
        <Greeting storeName={store.name} storeUrl={publicStoreUrl(store)} />
      </Reveal>

      {/* دليل الإعداد — بيختفي بالكامل لما يخلص */}
      <Reveal delay={60}>
        <SetupGuide steps={setup} />
      </Reveal>

      {/*
        الاشتراك والرسم جنب بعض على الشاشة الكبيرة.

        الاتنين بيتقروا مع بعض: «فاضلي كام يوم» و«ماشي إزاي». وعلى
        الموبايل بيبقوا فوق بعض والاشتراك الأول — لأنه اللي ليه
        ميعاد.
      */}
      <div className="grid gap-5 lg:grid-cols-[20rem_1fr] lg:items-start">
        <Reveal delay={100}>
          <PlanCard
            planLabel={plan?.name ?? (ent.isAdmin ? 'إدارة المنصة' : 'مجانية')}
            onTrial={ent.onTrial}
            daysLeft={ent.daysLeft}
            startedAt={store.activatedAt ?? store.createdAt}
            endsAt={ent.until}
            periodDays={plan?.days ?? 30}
            expired={ent.expired}
            isAdmin={ent.isAdmin}
          />
        </Reveal>

        <Reveal delay={140}>
          <Card className="p-5">
            <OverviewChart
              currency={store.currency}
              data={series.map(
                (d): OverviewSeries => ({
                  label: d.label,
                  sessions: d.sessions,
                  revenue: d.revenue,
                  orders: d.orders,
                  conversion: d.conversion,
                }),
              )}
            />
          </Card>
        </Reveal>
      </div>

      {/* الأرقام */}
      <Reveal delay={180}>
        <Rail desktop="sm:grid sm:grid-cols-2 lg:grid-cols-4" itemWidth="basis-[70%]">
          <StatTiles tiles={tiles} />
        </Rail>
      </Reveal>

      {/*
        اللي محتاج شغل دلوقتي.

        الطلب المستني والسلة المتروكة مش أرقام للعرض — دول شغل قدام
        التاجر بالظبط دلوقتي. عشان كده بيبانوا كأفعال لا كمربّعات،
        وبيختفوا لما يبقوا صفر.
      */}
      {((pending?.n ?? 0) > 0 || (incomplete?.n ?? 0) > 0) && (
        <Reveal delay={200}>
          <div className="grid gap-3 sm:grid-cols-2">
            {(pending?.n ?? 0) > 0 && (
              <ActionCard
                href="/dashboard/orders?filter=pending"
                icon={Package}
                title={`${pending.n} طلب مستني تأكيدك`}
                hint="أكّدهم عشان يتشحنوا"
              />
            )}
            {(incomplete?.n ?? 0) > 0 && (
              <ActionCard
                href="/dashboard/orders?filter=incomplete"
                icon={Users}
                title={`${incomplete.n} سلة متروكة`}
                hint="كلّمهم على واتساب — أسرع فلوس ترجّعها"
                tone="warning"
              />
            )}
          </div>
        </Reveal>
      )}

      {/* اختصارات */}
      <Reveal delay={220}>
        <Rail desktop="sm:grid sm:grid-cols-3" itemWidth="basis-[70%]">
          <QuickLink href="/dashboard/products/new" icon={Plus} label="ضيف منتج" />
          <QuickLink href="/dashboard/orders/new" icon={ShoppingBag} label="سجّل طلب" />
          <QuickLink href="/dashboard/storefront" icon={Palette} label="عدّل شكل المتجر" />
        </Rail>
      </Reveal>

      {/*
        آخر الطلبات — الرقم بيقول «فيه ٤»، والقايمة بتقول **مين**،
        والتاجر بيفتح اللوحة الصبح عشان ده بالظبط.
      */}
      {latestOrders.length > 0 && (
        <Reveal delay={260}>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">آخر الطلبات</h2>
              <Link
                href="/dashboard/orders"
                className="text-sm text-[var(--primary)] hover:underline"
              >
                كلها
              </Link>
            </div>

            <Card className="divide-y divide-[var(--border)] p-0">
              {latestOrders.map((o) => {
                const meta = ORDER_STATUSES.find((s) => s.key === o.status)
                return (
                  <Link
                    key={o.id}
                    href={`/dashboard/orders/${o.id}`}
                    className="flex items-center gap-3 p-3.5 transition-colors hover:bg-[var(--surface-2)] sm:p-4"
                  >
                    <span className="tabular shrink-0 text-sm font-semibold text-[var(--fg-muted)]">
                      #{formatOrderNumber(store, o.number)}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                      {o.name || 'بلا اسم'}
                    </span>
                    {meta && (
                      <span
                        className="shrink-0 rounded-md px-2 py-0.5 text-[11px] font-medium"
                        style={{ background: meta.bg, color: meta.fg }}
                      >
                        {meta.label}
                      </span>
                    )}
                    <span className="tabular shrink-0 text-sm font-semibold">
                      {formatMoney(o.total, store.currency)}
                    </span>
                  </Link>
                )
              })}
            </Card>
          </div>
        </Reveal>
      )}

      {/*
        الأكتر مبيعًا — بيجاوب على «أزوّد مخزون إيه وأعلن على إيه»،
        وده قرار التاجر بياخده كل أسبوع.
      */}
      {topProducts.length > 0 && (
        <Reveal delay={300}>
          <div className="flex flex-col gap-3">
            <h2 className="font-semibold">الأكتر مبيعًا · آخر ٣٠ يوم</h2>
            <Card className="divide-y divide-[var(--border)] p-0">
              {topProducts.map((p) => (
                <div key={p.productId ?? p.name} className="flex items-center gap-3 p-3.5 sm:p-4">
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                    {p.image && (
                      <Image src={p.image} alt="" fill sizes="40px" className="object-cover" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.name}</span>
                  <span className="tabular shrink-0 text-sm text-[var(--fg-muted)]">
                    {Number(p.sold ?? 0)} مبيع
                  </span>
                </div>
              ))}
            </Card>
          </div>
        </Reveal>
      )}

      <Reveal delay={340}>
        <p className="text-sm text-[var(--fg-subtle)]">
          عندك {productCount?.n ?? 0} منتج نشط و{customerCount?.n ?? 0} عميل مسجّل.
        </p>
      </Reveal>
    </div>
  )
}

function ActionCard({
  href,
  icon: Icon,
  title,
  hint,
  tone,
}: {
  href: string
  icon: typeof Package
  title: string
  hint: string
  tone?: 'warning'
}) {
  const warn = tone === 'warning'
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-[var(--radius-card)] border p-4 transition-colors"
      style={{
        borderColor: warn ? 'var(--color-warning)' : 'var(--border)',
        background: warn ? 'var(--color-warning-soft)' : 'var(--surface)',
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: warn ? 'var(--surface)' : 'var(--primary-soft)',
          color: warn ? 'var(--color-warning)' : 'var(--primary)',
        }}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{title}</span>
        <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">{hint}</span>
      </span>
      <ArrowLeft
        className="h-4 w-4 shrink-0 text-[var(--fg-subtle)] transition-transform group-hover:-translate-x-0.5 motion-reduce:transition-none"
        aria-hidden="true"
      />
    </Link>
  )
}

function QuickLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: typeof Package
  label: string
}) {
  return (
    <Link
      href={href}
      className="flex h-full items-center gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4 transition-colors hover:bg-[var(--surface-2)]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium">{label}</span>
      <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
    </Link>
  )
}
