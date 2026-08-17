import Link from 'next/link'
import { and, count, eq, gte, sum } from 'drizzle-orm'
import {
  ArrowLeft,
  CreditCard,
  Package,
  Palette,
  ShoppingBag,
  Truck,
  Users,
  Wallet,
} from 'lucide-react'
import { db } from '@/db'
import { orders, products, customers, paymentMethods, shippingZones } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { formatMoney } from '@/lib/utils'
import { Card } from '@/components/ui'

export const metadata = { title: 'لوحة التحكم' }

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default async function DashboardHome() {
  const { store } = await getDashboardContext()
  const today = startOfToday()

  // الأرقام محسوبة على مستوى قاعدة البيانات — لا نجلب صفوفًا لنعدّها في الذاكرة
  const [todayStats] = await db
    .select({ orders: count(), revenue: sum(orders.total) })
    .from(orders)
    .where(
      and(eq(orders.storeId, store.id), eq(orders.isIncomplete, false), gte(orders.createdAt, today)),
    )

  const [pending] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.status, 'pending')))

  const [incomplete] = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.isIncomplete, true)))

  const [productCount] = await db
    .select({ n: count() })
    .from(products)
    .where(and(eq(products.storeId, store.id), eq(products.status, 'active')))

  const [customerCount] = await db
    .select({ n: count() })
    .from(customers)
    .where(eq(customers.storeId, store.id))

  const stats = [
    {
      label: 'إيرادات اليوم',
      value: formatMoney(Number(todayStats?.revenue ?? 0), store.currency),
      icon: Wallet,
    },
    { label: 'طلبات اليوم', value: String(todayStats?.orders ?? 0), icon: ShoppingBag },
    { label: 'طلبات مستنية', value: String(pending?.n ?? 0), icon: Package, href: '/dashboard/orders' },
    {
      label: 'سلات متروكة',
      value: String(incomplete?.n ?? 0),
      icon: Users,
      href: '/dashboard/orders?filter=incomplete',
      highlight: (incomplete?.n ?? 0) > 0,
    },
  ]

  // خطوات التجهيز — تظهر لحد ما المتجر يبقى جاهز للبيع
  const [hasPayment] = await db
    .select({ n: count() })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.storeId, store.id), eq(paymentMethods.enabled, true)))

  const [hasShipping] = await db
    .select({ n: count() })
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, store.id), eq(shippingZones.enabled, true)))

  const setup = [
    {
      done: (productCount?.n ?? 0) > 0,
      label: 'ضيف أول منتج',
      href: '/dashboard/products',
      icon: Package,
    },
    { done: (hasShipping?.n ?? 0) > 0, label: 'ظبّط الشحن', href: '/dashboard/shipping', icon: Truck },
    {
      done: (hasPayment?.n ?? 0) > 0,
      label: 'فعّل طريقة دفع',
      href: '/dashboard/payments',
      icon: CreditCard,
    },
    {
      done: !!store.logoLight,
      label: 'ارفع شعار متجرك',
      href: '/dashboard/storefront',
      icon: Palette,
    },
    { done: store.isPublished, label: 'انشر المتجر', href: '/dashboard/settings', icon: ShoppingBag },
  ]

  const remaining = setup.filter((s) => !s.done)

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">أهلًا، {store.name}</h1>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          {remaining.length > 0
            ? `فاضل ${remaining.length} خطوة عشان متجرك يبقى جاهز للبيع.`
            : 'متجرك جاهز. بالتوفيق في مبيعاتك.'}
        </p>
      </div>

      {/* الأرقام */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href, highlight }) => {
          const body = (
            <Card
              className={`flex h-full flex-col gap-2 p-4 transition-colors ${
                href ? 'hover:border-[var(--border-strong)]' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--fg-muted)]">{label}</span>
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    highlight ? 'text-[var(--color-warning)]' : 'text-[var(--fg-subtle)]'
                  }`}
                  aria-hidden="true"
                />
              </div>
              <span className="tabular text-xl font-bold tracking-tight sm:text-2xl">{value}</span>
            </Card>
          )
          return href ? (
            <Link key={label} href={href} className="contents">
              {body}
            </Link>
          ) : (
            <div key={label}>{body}</div>
          )
        })}
      </div>

      {/* خطوات التجهيز */}
      {remaining.length > 0 && (
        <Card className="overflow-hidden">
          <div className="border-b border-[var(--border)] px-5 py-4">
            <h2 className="font-semibold">جهّز متجرك</h2>
          </div>
          <ul className="divide-y divide-[var(--border)]">
            {setup.map(({ done, label, href, icon: Icon }) => (
              <li key={label}>
                <Link
                  href={href}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-[var(--surface-2)]"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      done
                        ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                        : 'bg-[var(--surface-2)] text-[var(--fg-subtle)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span
                    className={`flex-1 text-sm ${
                      done ? 'text-[var(--fg-subtle)] line-through' : 'font-medium'
                    }`}
                  >
                    {label}
                  </span>
                  {!done && (
                    <ArrowLeft className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <p className="text-sm text-[var(--fg-subtle)]">
        عندك {productCount?.n ?? 0} منتج نشط و{customerCount?.n ?? 0} عميل مسجّل.
      </p>
    </div>
  )
}
