import { notFound } from 'next/navigation'
import Image from 'next/image'
import { SLink as Link } from '@/components/storefront/store-link'
import { and, desc, eq } from 'drizzle-orm'
import { Heart, MapPin, Package, Sparkles } from 'lucide-react'
import { db } from '@/db'
import { customerAddresses, orders, products, wishlists } from '@/db/schema'
import { getStore } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/customer-auth'
import { formatDate, formatMoney } from '@/lib/utils'
import { statusMeta } from '@/lib/order-status'
import { getLoyaltySettings, getPointsBalance, nextTier, tierForPoints } from '@/lib/loyalty'
import { listActiveRewards } from '@/lib/rewards'
import { tierAllows, TIER_LABELS } from '@/lib/rewards-meta'
import { RewardsCatalog, type CatalogReward } from '@/components/storefront/rewards-catalog'
import { ReferralCard } from '@/components/storefront/referral-card'
import { getOrCreateReferralCode, getReferralStats } from '@/lib/referrals'
import { publicStoreUrl } from '@/lib/domain'
import { CustomerLoginForm } from './login-form'
import { LogoutButton } from './logout-button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'حسابي' }

export default async function AccountPage({ params }: { params: Promise<{ store: string }> }) {
  const { store: identifier } = await params
  const store = await getStore(identifier)
  if (!store) notFound()

  const customer = await getCurrentCustomer(store.id)

  if (!customer) {
    return (
      <div className="px-4 py-16 sm:px-6">
        <CustomerLoginForm storeIdentifier={identifier} />
      </div>
    )
  }

  const [myOrders, saved, addresses] = await Promise.all([
    db
      .select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        status: orders.status,
        total: orders.total,
        currency: orders.currency,
        createdAt: orders.createdAt,
        recoveryToken: orders.recoveryToken,
      })
      .from(orders)
      .where(and(eq(orders.customerId, customer.id), eq(orders.isIncomplete, false)))
      .orderBy(desc(orders.createdAt))
      .limit(20),

    db
      .select({
        id: products.id,
        name: products.name,
        slug: products.slug,
        price: products.price,
        images: products.images,
      })
      .from(wishlists)
      .innerJoin(products, eq(products.id, wishlists.productId))
      .where(eq(wishlists.customerId, customer.id))
      .orderBy(desc(wishlists.createdAt)),

    db
      .select()
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, customer.id))
      .orderBy(desc(customerAddresses.isDefault)),
  ])

  /**
   * الولاء.
   *
   * الرصيد بيتقرا من سجل الحركات لا من العمود المنسوخ — السجل هو
   * المرجع لو حصل خلاف، والعميل بيشوف رقمًا يقدر يفسّره من حركاته.
   */
  const loyalty = await getLoyaltySettings(store.id)
  const showLoyalty = Boolean(loyalty?.enabled)

  const [balance, rewardRows] = showLoyalty
    ? await Promise.all([getPointsBalance(customer.id), listActiveRewards(store.id)])
    : [0, []]

  /*
    كود الإحالة بيتولّد أول ما العميل يفتح حسابه — مش وقت التسجيل.
    أغلب العملاء ما بيحيلوش حد، فما نملاش الجدول أكوادًا ما اتشافتش.
  */
  const referral =
    showLoyalty && loyalty!.referralPoints > 0
      ? await (async () => {
          const code = await getOrCreateReferralCode(store.id, customer.id)
          return {
            code,
            link: publicStoreUrl(store, `/?rf=${code}`),
            stats: await getReferralStats(store.id, customer.id),
          }
        })()
      : null

  const tier = showLoyalty ? tierForPoints(loyalty, customer.lifetimePoints) : null
  const upcoming = showLoyalty ? nextTier(loyalty, customer.lifetimePoints) : null

  /*
    القفل بيتحسب هنا على الخادم: المكافأة اللي فوق مستوى العميل
    بتتعرض مقفولة، والاسترداد نفسه بيعيد الفحص — الإخفاء تحسين شكلي
    مش حماية.
  */
  const catalog: CatalogReward[] = rewardRows.map((r) => {
    const allowed = tierAllows(customer.tier, r.minTier)
    return {
      id: r.id,
      name: r.name,
      description: r.description,
      type: r.type,
      value: r.value,
      pointsCost: r.pointsCost,
      minTier: r.minTier,
      stock: r.stock,
      locked: !allowed,
      lockReason: allowed
        ? null
        : `لمستوى ${TIER_LABELS[r.minTier as keyof typeof TIER_LABELS] ?? ''} فأعلى`,
    }
  })

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {customer.name ? `أهلًا ${customer.name}` : 'حسابك'}
          </h1>
          <bdi dir="ltr" className="mt-1 block text-start text-sm opacity-65">
            {customer.phone}
          </bdi>
        </div>
        <LogoutButton storeIdentifier={identifier} />
      </div>

      {showLoyalty && (
        <section className="mb-10 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="flex items-center gap-2 text-sm opacity-65">
                <Sparkles className="h-4 w-4 text-[var(--sf-primary)]" aria-hidden="true" />
                رصيد نقاطك
              </span>
              <span className="tabular mt-1 block text-3xl font-bold text-[var(--sf-primary)]">
                {balance}
              </span>
            </div>
            {tier && (
              <div className="text-end">
                <span className="text-xs opacity-60">مستواك</span>
                <span className="block font-bold">{tier.name}</span>
              </div>
            )}
          </div>

          {upcoming && (
            <p className="mt-3 text-sm opacity-70">
              فاضلك{' '}
              <span className="tabular font-bold text-[var(--sf-primary)]">
                {upcoming.remaining}
              </span>{' '}
              نقطة وتوصل لمستوى {upcoming.tier.name}.
            </p>
          )}
        </section>
      )}

      {showLoyalty && (
        <RewardsCatalog
          storeIdentifier={identifier}
          rewards={catalog}
          balance={balance}
          currency={store.currency}
        />
      )}

      {referral && (
        <ReferralCard
          code={referral.code}
          link={referral.link}
          pointsPerReferral={loyalty!.referralPoints}
          stats={referral.stats}
        />
      )}

      {/* الطلبات */}
      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <Package className="h-4 w-4 text-[var(--sf-primary)]" aria-hidden="true" />
          طلباتي
        </h2>

        {myOrders.length === 0 ? (
          <p className="py-6 text-center text-sm opacity-60">لسه ماطلبتش حاجة.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {myOrders.map((o) => {
              const meta = statusMeta(o.status)
              return (
                <li key={o.id}>
                  <Link
                    href={`/order/${o.orderNumber}?t=${encodeURIComponent(o.recoveryToken ?? '')}`}
                    className="flex flex-wrap items-center gap-3 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 p-3 transition-colors hover:bg-[var(--sf-text)]/4"
                  >
                    <span className="tabular font-bold">#{o.orderNumber}</span>
                    <span
                      className="rounded-md px-2 py-0.5 text-xs font-medium"
                      style={{ background: meta.bg, color: meta.fg }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-xs opacity-60">{formatDate(o.createdAt)}</span>
                    <span className="tabular ms-auto font-semibold">
                      {formatMoney(o.total, o.currency)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      {/* المفضّلة */}
      <section className="mb-10">
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <Heart className="h-4 w-4 text-[var(--sf-primary)]" aria-hidden="true" />
          مفضّلاتي
        </h2>

        {saved.length === 0 ? (
          <p className="py-6 text-center text-sm opacity-60">
            مفيش منتجات محفوظة. اضغط على القلب في أي منتج عشان تحفظه.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {saved.map((p) => (
              <Link key={p.id} href={`/products/${p.slug}`} className="group flex flex-col gap-2">
                <span className="relative block aspect-square overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6">
                  {p.images[0] && (
                    <Image src={p.images[0]} alt={p.name} fill sizes="200px" className="object-cover" />
                  )}
                </span>
                <span className="line-clamp-2 text-sm font-medium">{p.name}</span>
                <span className="tabular text-sm font-bold text-[var(--sf-primary)]">
                  {formatMoney(p.price, store.currency)}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* العناوين */}
      <section>
        <h2 className="mb-4 flex items-center gap-2 font-bold">
          <MapPin className="h-4 w-4 text-[var(--sf-primary)]" aria-hidden="true" />
          عناويني
        </h2>

        {addresses.length === 0 ? (
          <p className="py-6 text-center text-sm opacity-60">
            مفيش عناوين محفوظة. العنوان بيتحفظ تلقائيًا مع أول طلب.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {addresses.map((a) => (
              <li
                key={a.id}
                className="rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{a.label || a.city}</span>
                  {a.isDefault && (
                    <span className="rounded-md bg-[var(--sf-primary)]/10 px-2 py-0.5 text-xs text-[var(--sf-primary)]">
                      الافتراضي
                    </span>
                  )}
                </div>
                <p className="mt-1 opacity-70">
                  {[a.street, a.building, a.area, a.city].filter(Boolean).join('، ')}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
