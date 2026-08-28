import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { Clock, Inbox, ShieldCheck, Users } from 'lucide-react'
import { db } from '@/db'
import { orders, storeMembers, stores, subscriptionRequests, users } from '@/db/schema'
import { requirePlatformAdmin } from '@/lib/store-context'
import { getPlan, STATUS_LABEL, daysLeft } from '@/lib/plans'
import { normalizeAccountId, looksLikeAccountId } from '@/lib/account-id'
import { billing } from '@/lib/billing'
import { formatMoney, formatDate } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { AdminSearch } from './admin-search'
import { StoreRow, type AdminStoreRow } from './store-row'

export const metadata = { title: 'إدارة المنصة' }

/**
 * لوحة إدارة المنصة.
 *
 * ## اللي بتعرضه واللي **مش** بتعرضه
 * بيانات الاشتراك بس: اسم المتجر، معرّف الحساب، صاحبه، الحالة، وعدد
 * الطلبات. مفيش أي منتج ولا طلب ولا عميل ولا رسالة من جوّه أي متجر —
 * العزل في `getDashboardContext` ما اتلمسش، ولوحة الإدارة مش طريق
 * تاني حواليه.
 *
 * ## ليه الصفحة مش مخبّية ورا شرط في الواجهة بس
 * `requirePlatformAdmin` بترجّع 404 لغير الأدمن، وكل فعل في
 * `actions.ts` بيعيد الفحص لوحده. الاتنين لازم — الصفحة بتخبّي
 * الأزرار، والأفعال هي اللي بتمنع النداء المباشر.
 */

const PAGE_SIZE = 30

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  await requirePlatformAdmin()

  const { q } = await searchParams
  const term = (q ?? '').trim()

  /*
    البحث بيجرّب معرّف الحساب الأول.

    المعرّف هو اللي بيتبعت في رسالة التأكيد، فهو أكتر حاجة هتتلزق في
    الخانة دي. توحيد صيغته قبل المقارنة بيخلّي «zw 4k7m…» و«ZW-4K7M…»
    يلاقوا نفس الحساب.
  */
  const asAccountId = looksLikeAccountId(term) ? normalizeAccountId(term) : null
  const like = '%' + term + '%'

  const filter = !term
    ? undefined
    : asAccountId
      ? eq(users.publicId, asAccountId)
      : or(
          ilike(stores.name, like),
          ilike(stores.slug, like),
          ilike(users.email, like),
          ilike(users.name, like),
          ilike(sql`coalesce(${users.publicId}, '')`, like),
        )

  const rows = await db
    .select({
      storeId: stores.id,
      storeName: stores.name,
      storeSlug: stores.slug,
      status: stores.status,
      plan: stores.plan,
      trialEndsAt: stores.trialEndsAt,
      subscribedUntil: stores.subscribedUntil,
      currency: stores.currency,
      createdAt: stores.createdAt,
      ownerName: users.name,
      ownerEmail: users.email,
      accountId: users.publicId,
      isAdmin: users.isPlatformAdmin,
    })
    .from(stores)
    /*
      leftJoin لا innerJoin.

      المتجر اللي مالوش صف مالك — تسجيل وقع في نصّه، أو عضوية
      اتمسحت — كان بيختفي من اللوحة تمامًا مع innerJoin. متجر شغّال
      ومحدّش شايفه من الإدارة نقطة عمياء، مش صف زيادة.
    */
    .leftJoin(
      storeMembers,
      and(eq(storeMembers.storeId, stores.id), eq(storeMembers.role, 'owner')),
    )
    .leftJoin(users, eq(users.id, storeMembers.userId))
    .where(and(isNull(stores.deletedAt), filter))
    .orderBy(desc(stores.createdAt))
    .limit(PAGE_SIZE)

  const storeIds = rows.map((r) => r.storeId)

  /*
    عدّاد الطلبات ومعه الطلبات المعلّقة — استعلامين مجمّعين لا استعلام
    لكل صف. تلاتين متجرًا × استعلامين = ٦٠ رحلة للخادم، وده بيخلّي
    الصفحة تقعد ثواني على وصلة عادية.
  */
  const [orderCounts, pendingRequests] = await Promise.all([
    storeIds.length
      ? db
          .select({ storeId: orders.storeId, n: count() })
          .from(orders)
          .where(and(inArray(orders.storeId, storeIds), eq(orders.isIncomplete, false)))
          .groupBy(orders.storeId)
      : Promise.resolve([] as Array<{ storeId: string; n: number }>),
    storeIds.length
      ? db
          .select({
            id: subscriptionRequests.id,
            storeId: subscriptionRequests.storeId,
            plan: subscriptionRequests.plan,
            amount: subscriptionRequests.amount,
            method: subscriptionRequests.method,
            createdAt: subscriptionRequests.createdAt,
          })
          .from(subscriptionRequests)
          .where(
            and(
              inArray(subscriptionRequests.storeId, storeIds),
              eq(subscriptionRequests.status, 'pending'),
            ),
          )
          .orderBy(desc(subscriptionRequests.createdAt))
      : Promise.resolve(
          [] as Array<{
            id: string
            storeId: string
            plan: string
            amount: number
            method: string
            createdAt: Date
          }>,
        ),
  ])

  const countByStore = new Map(orderCounts.map((r) => [r.storeId, r.n]))
  const requestByStore = new Map<string, (typeof pendingRequests)[number]>()
  for (const r of pendingRequests) if (!requestByStore.has(r.storeId)) requestByStore.set(r.storeId, r)

  /** كل الطلبات المعلّقة على مستوى المنصة — مش المعروضة في النتيجة بس */
  const [{ n: pendingTotal } = { n: 0 }] = await db
    .select({ n: count() })
    .from(subscriptionRequests)
    .where(eq(subscriptionRequests.status, 'pending'))

  const [{ n: storesTotal } = { n: 0 }] = await db
    .select({ n: count() })
    .from(stores)
    .where(isNull(stores.deletedAt))

  const now = Date.now()

  const view: AdminStoreRow[] = rows.map((r) => {
    const paidUntil = r.subscribedUntil ? new Date(r.subscribedUntil) : null
    const trialUntil = r.trialEndsAt ? new Date(r.trialEndsAt) : null
    const paidLive = Boolean(paidUntil && paidUntil.getTime() > now)
    const trialLive = !paidLive && Boolean(trialUntil && trialUntil.getTime() > now)
    const active = r.isAdmin || paidLive || trialLive
    const until = paidLive ? paidUntil : trialLive ? trialUntil : (paidUntil ?? trialUntil)
    const req = requestByStore.get(r.storeId) ?? null

    return {
      storeId: r.storeId,
      storeName: r.storeName,
      storeSlug: r.storeSlug,
      ownerName: r.ownerName ?? 'مافيش مالك',
      ownerEmail: r.ownerEmail ?? '—',
      accountId: r.accountId,
      status: r.status,
      statusLabel: r.isAdmin
        ? 'إدارة المنصة'
        : trialLive
          ? 'تجربة شغّالة'
          : active
            ? 'مشترك'
            : (STATUS_LABEL[r.status] ?? r.status),
      planName: trialLive ? 'تجربة مجانية' : (getPlan(r.plan)?.name ?? null),
      until: until ? formatDate(until) : null,
      daysLeft: daysLeft(until),
      active,
      orders: countByStore.get(r.storeId) ?? 0,
      request: req
        ? {
            id: req.id,
            planKey: req.plan as 'trial' | 'monthly' | 'yearly',
            planName: getPlan(req.plan)?.name ?? req.plan,
            amount: formatMoney(req.amount, r.currency),
            method: req.method,
            at: formatDate(req.createdAt),
          }
        : null,
    }
  })

  /* الطلبات المعلّقة فوق — دي اللي محتاجة قرار دلوقتي */
  const pendingFirst = [...view].sort((a, b) => Number(Boolean(b.request)) - Number(Boolean(a.request)))

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="إدارة المنصة"
        description="تفعيل اشتراكات التجّار ومراجعة طلبات الدفع."
        action={
          <span className="flex items-center gap-2 rounded-lg bg-[var(--primary-soft)] px-3 py-2 text-sm font-semibold text-[var(--primary)]">
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            صلاحية إدارة
          </span>
        }
      />

      {/* أرقام سريعة */}
      <Reveal>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat icon={Clock} label="طلبات مستنية قرار" value={pendingTotal} highlight={pendingTotal > 0} />
          <Stat icon={Users} label="إجمالي المتاجر" value={storesTotal} />
          <Card className="flex flex-col justify-center gap-1 p-4">
            <span className="text-xs text-[var(--fg-subtle)]">رقم التحصيل</span>
            <bdi dir="ltr" className="tabular text-lg font-bold tracking-wider">
              {billing.payTo}
            </bdi>
            <span className="text-xs text-[var(--fg-subtle)]">محفظة وإنستا باي</span>
          </Card>
        </div>
      </Reveal>

      <Reveal delay={50}>
        <AdminSearch initial={term} />
      </Reveal>

      {view.length === 0 ? (
        <Reveal delay={80}>
          <Card className="flex flex-col items-center gap-3 p-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--surface-2)] text-[var(--fg-subtle)]">
              <Inbox className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-sm text-[var(--fg-muted)]">
              {term ? (
                <>
                  مفيش حساب بـ«{term}». جرّب معرّف الحساب زي ما التاجر بعته بالظبط، أو اسم
                  المتجر.
                </>
              ) : (
                'لسه مفيش متاجر.'
              )}
            </p>
          </Card>
        </Reveal>
      ) : (
        <div className="flex flex-col gap-4">
          {pendingFirst.map((row, i) => (
            <Reveal key={row.storeId} delay={Math.min(i * 40, 200)}>
              <StoreRow row={row} />
            </Reveal>
          ))}
        </div>
      )}

      {!term && storesTotal > view.length && (
        <p className="text-center text-sm text-[var(--fg-subtle)]">
          بنعرض آخر {view.length} متجر من {storesTotal}. دوّر بمعرّف الحساب أو اسم المتجر عشان
          توصل لحساب معيّن.
        </p>
      )}
    </div>
  )
}

function Stat({
  icon: Icon,
  label,
  value,
  highlight,
}: {
  icon: typeof Clock
  label: string
  value: number
  highlight?: boolean
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
        style={{
          background: highlight ? 'var(--color-warning-soft)' : 'var(--surface-2)',
          color: highlight ? 'var(--color-warning)' : 'var(--fg-muted)',
        }}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="tabular block text-xl font-bold leading-tight">{value}</span>
        <span className="block text-xs text-[var(--fg-subtle)]">{label}</span>
      </span>
    </Card>
  )
}
