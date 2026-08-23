import Link from 'next/link'
import Image from 'next/image'
import { and, desc, eq } from 'drizzle-orm'
import { Boxes, ImageOff } from 'lucide-react'
import { db } from '@/db'
import { inventoryMovements, products, productVariants } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { formatDateTime, formatMoney } from '@/lib/utils'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { StockCell, ThresholdCell } from './stock-row'

export const metadata = { title: 'المخزون' }

type Filter = 'all' | 'low' | 'out'

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: 'all', label: 'الكل' },
  { key: 'low', label: 'مخزون منخفض' },
  { key: 'out', label: 'نافد' },
]

const REASONS: Record<string, string> = {
  order: 'طلب',
  return: 'مرتجع',
  cancel: 'إلغاء طلب',
  manual: 'تعديل يدوي',
  restock: 'توريد',
  import: 'استيراد',
  transfer: 'نقل بين الفروع',
}

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const { store } = await getDashboardContext()
  const params = await searchParams
  const filter: Filter = params.filter === 'low' || params.filter === 'out' ? params.filter : 'all'

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      images: products.images,
      stock: products.stock,
      threshold: products.lowStockThreshold,
      trackInventory: products.trackInventory,
      costPrice: products.costPrice,
    })
    .from(products)
    .where(and(eq(products.storeId, store.id), eq(products.trackInventory, true)))
    .orderBy(products.stock, products.name)
    .limit(300)

  const variants = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      title: productVariants.title,
      sku: productVariants.sku,
      stock: productVariants.stock,
    })
    .from(productVariants)
    .where(and(eq(productVariants.storeId, store.id), eq(productVariants.isActive, true)))
    .orderBy(productVariants.position)

  const byProduct = new Map<string, typeof variants>()
  for (const v of variants) {
    const list = byProduct.get(v.productId) ?? []
    list.push(v)
    byProduct.set(v.productId, list)
  }

  /**
   * المنتج اللي ليه متغيّرات، مخزونه الحقيقي هو مجموع مخزونها — خانة
   * المنتج نفسها بتبقى غير مستعملة. بنحسب الاتنين ونعرض الصح.
   */
  const enriched = rows.map((p) => {
    const vs = byProduct.get(p.id) ?? []
    const effective = vs.length ? vs.reduce((sum, v) => sum + v.stock, 0) : p.stock
    return { ...p, variants: vs, effective }
  })

  const visible = enriched.filter((p) => {
    if (filter === 'out') return p.effective <= 0
    if (filter === 'low') return p.effective > 0 && p.effective <= p.threshold
    return true
  })

  const outCount = enriched.filter((p) => p.effective <= 0).length
  const lowCount = enriched.filter((p) => p.effective > 0 && p.effective <= p.threshold).length
  const units = enriched.reduce((sum, p) => sum + Math.max(0, p.effective), 0)
  // قيمة المخزون بالتكلفة لا بسعر البيع — ده الفلوس المدفوعة فعلًا واللي واقفة في المخزن
  const value = enriched.reduce((sum, p) => sum + Math.max(0, p.effective) * (p.costPrice ?? 0), 0)

  const movements = await db
    .select({
      id: inventoryMovements.id,
      delta: inventoryMovements.delta,
      reason: inventoryMovements.reason,
      note: inventoryMovements.note,
      createdAt: inventoryMovements.createdAt,
      productName: products.name,
    })
    .from(inventoryMovements)
    .leftJoin(products, eq(products.id, inventoryMovements.productId))
    .where(eq(inventoryMovements.storeId, store.id))
    .orderBy(desc(inventoryMovements.createdAt))
    .limit(40)

  const stats = [
    { label: 'قطع في المخزن', value: units.toLocaleString('ar-EG') },
    { label: 'قيمة المخزون بالتكلفة', value: formatMoney(value, store.currency) },
    { label: 'نافد', value: String(outCount), danger: outCount > 0 },
    { label: 'مخزون منخفض', value: String(lowCount), warn: lowCount > 0 },
  ]

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="المخزون" description="كمياتك وحركتها — وإجابة سؤال «المخزون راح فين؟»" />

      {enriched.length === 0 ? (
        <Reveal>
          <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Boxes className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">مافيش منتجات بتتبّع مخزون</h2>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              فعّل «تتبّع المخزون» في صفحة المنتج، وهيظهر هنا.
            </p>
            <Link
              href="/dashboard/products"
              className="text-sm font-medium text-[var(--primary)] hover:underline"
            >
              روح للمنتجات
            </Link>
          </Card>
        </Reveal>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((s, i) => (
              <Reveal key={s.label} delay={i * 60}>
                <Card className="flex flex-col gap-1 p-4">
                  <span className="text-xs text-[var(--fg-muted)]">{s.label}</span>
                  <span
                    className="tabular text-xl font-bold tracking-tight"
                    style={{
                      color: s.danger
                        ? 'var(--color-danger)'
                        : s.warn
                          ? 'var(--color-warning)'
                          : undefined,
                    }}
                  >
                    {s.value}
                  </span>
                </Card>
              </Reveal>
            ))}
          </div>

          <Reveal>
            <div className="flex flex-wrap gap-2">
              {FILTERS.map((f) => (
                <Link
                  key={f.key}
                  href={f.key === 'all' ? '/dashboard/inventory' : `/dashboard/inventory?filter=${f.key}`}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    filter === f.key
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'border-[var(--border)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]'
                  }`}
                >
                  {f.label}
                  {f.key === 'out' && outCount > 0 && ` (${outCount})`}
                  {f.key === 'low' && lowCount > 0 && ` (${lowCount})`}
                </Link>
              ))}
            </div>
          </Reveal>

          <Reveal>
            <Card className="overflow-hidden">
              <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-2.5 text-xs text-[var(--fg-muted)]">
                <span className="flex-1">المنتج</span>
                <span className="w-[132px] shrink-0">المتاح</span>
                <span className="hidden w-16 shrink-0 sm:block">نبّهني عند</span>
              </div>

              {visible.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-[var(--fg-muted)]">
                  مافيش منتجات في الفلتر ده — وده خبر كويس.
                </p>
              ) : (
                <ul className="divide-y divide-[var(--border)]">
                  {visible.map((p) => (
                    <li key={p.id} className="flex flex-col gap-2 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-md bg-[var(--surface-2)]">
                          {p.images[0] ? (
                            <Image src={p.images[0]} alt="" fill sizes="40px" className="object-cover" />
                          ) : (
                            <span className="flex h-full items-center justify-center text-[var(--fg-subtle)]">
                              <ImageOff className="h-4 w-4" aria-hidden="true" />
                            </span>
                          )}
                        </span>

                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/dashboard/products/${p.id}`}
                            className="block truncate text-sm font-medium hover:text-[var(--primary)]"
                          >
                            {p.name}
                          </Link>
                          {p.sku && (
                            <bdi dir="ltr" className="block text-start text-xs text-[var(--fg-subtle)]">
                              {p.sku}
                            </bdi>
                          )}
                        </div>

                        <div className="w-[132px] shrink-0">
                          {p.variants.length ? (
                            <span
                              className="tabular text-sm"
                              style={{
                                color:
                                  p.effective <= 0
                                    ? 'var(--color-danger)'
                                    : p.effective <= p.threshold
                                      ? 'var(--color-warning)'
                                      : 'var(--fg-muted)',
                              }}
                            >
                              {p.effective} في {p.variants.length} متغيّر
                            </span>
                          ) : (
                            <StockCell kind="product" id={p.id} stock={p.stock} threshold={p.threshold} />
                          )}
                        </div>

                        <div className="hidden w-16 shrink-0 sm:block">
                          <ThresholdCell productId={p.id} threshold={p.threshold} />
                        </div>
                      </div>

                      {p.variants.length > 0 && (
                        <ul className="flex flex-col gap-1.5 border-t border-dashed border-[var(--border)] pt-2 ps-3">
                          {p.variants.map((v) => (
                            <li key={v.id} className="flex items-center gap-3">
                              <span className="min-w-0 flex-1 truncate text-sm text-[var(--fg-muted)]">
                                {v.title}
                              </span>
                              <div className="w-[132px] shrink-0">
                                <StockCell
                                  kind="variant"
                                  id={v.id}
                                  stock={v.stock}
                                  threshold={p.threshold}
                                  compact
                                />
                              </div>
                              <span className="hidden w-16 shrink-0 sm:block" />
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </Reveal>

          {movements.length > 0 && (
            <Reveal>
              <Card className="overflow-hidden">
                <h2 className="border-b border-[var(--border)] px-4 py-3 font-semibold">سجل الحركة</h2>
                <ul className="divide-y divide-[var(--border)]">
                  {movements.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                      <span
                        className="tabular w-14 shrink-0 font-bold"
                        style={{
                          color: m.delta > 0 ? 'var(--color-success)' : 'var(--color-danger)',
                        }}
                      >
                        {m.delta > 0 ? `+${m.delta}` : m.delta}
                      </span>
                      <span className="min-w-0 flex-1 truncate">
                        {m.productName ?? 'منتج متشال'}
                        {m.note && <span className="text-[var(--fg-subtle)]"> — {m.note}</span>}
                      </span>
                      <span className="hidden shrink-0 text-xs text-[var(--fg-muted)] sm:block">
                        {REASONS[m.reason] ?? m.reason}
                      </span>
                      <span className="shrink-0 text-xs text-[var(--fg-subtle)]">
                        {formatDateTime(m.createdAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            </Reveal>
          )}
        </>
      )}
    </div>
  )
}
