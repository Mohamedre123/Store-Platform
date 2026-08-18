import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories, coupons, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { CouponsManager, type CouponRow } from './coupons-manager'

export const metadata = { title: 'التسويق' }

export default async function MarketingPage() {
  const { store } = await getDashboardContext()

  const [couponRows, productRows, categoryRows] = await Promise.all([
    db
      .select()
      .from(coupons)
      .where(eq(coupons.storeId, store.id))
      .orderBy(desc(coupons.isActive), desc(coupons.createdAt))
      .limit(200),
    db
      .select({ id: products.id, name: products.name })
      .from(products)
      .where(and(eq(products.storeId, store.id), eq(products.status, 'active')))
      .orderBy(products.name)
      .limit(500),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.storeId, store.id))
      .orderBy(categories.sortOrder),
  ])

  const rows = couponRows as CouponRow[]
  const active = rows.filter((c) => c.isActive).length
  const totalUses = rows.reduce((n, c) => n + c.usedCount, 0)

  const stats = [
    { label: 'كوبونات مفعّلة', value: String(active) },
    { label: 'إجمالي الاستخدامات', value: String(totalUses) },
    { label: 'كل الكوبونات', value: String(rows.length) },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="التسويق"
        description="كوبونات الخصم — بتظهر للعميل في الشيك أوت وبتتطبّق فورًا."
      />

      {rows.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 60}>
              <Card className="flex flex-col gap-1 p-4">
                <span className="text-xs text-[var(--fg-muted)]">{s.label}</span>
                <span className="tabular text-xl font-bold tracking-tight">{s.value}</span>
              </Card>
            </Reveal>
          ))}
        </div>
      )}

      <Reveal delay={100}>
        <CouponsManager
          coupons={rows}
          currency={store.currency}
          products={productRows}
          categories={categoryRows}
        />
      </Reveal>
    </div>
  )
}
