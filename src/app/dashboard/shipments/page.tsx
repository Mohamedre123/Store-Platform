import { and, desc, eq, inArray, isNull, notInArray, sql } from 'drizzle-orm'
import { Truck } from 'lucide-react'
import { db } from '@/db'
import { orders, shipments } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { guard } from '@/lib/permissions'
import { PageHeader } from '@/components/dashboard/page-shell'
import { Reveal } from '@/components/motion'
import { Card } from '@/components/ui'
import { formatMoney } from '@/lib/utils'
import { activeCarrier } from '@/lib/provider-store'
import { carrierProvider } from '@/lib/providers'
import { ShipmentsManager, type PendingOrder, type ShipmentRow } from './shipments-manager'

export const metadata = { title: 'الشحنات' }

export default async function ShipmentsPage() {
  const { store, actor } = await getDashboardContext()
  guard(actor, 'orders.view')

  /*
    الشركة المربوطة بربط تلقائي — اللي التاجر يقدر يبعتلها بضغطة.
    اليدوية مش بتتحسب هنا: زرار «ابعت» عليها كان هيفشل كل مرة.
  */
  const carrier = await activeCarrier(store.id)
  const autoCarrierName = carrier ? (carrierProvider(carrier.slug)?.name ?? null) : null

  const rows = await db
    .select({
      id: shipments.id,
      carrier: shipments.carrier,
      trackingNumber: shipments.trackingNumber,
      status: shipments.status,
      codAmount: shipments.codAmount,
      shippingCost: shipments.shippingCost,
      isCodCollected: shipments.isCodCollected,
      settledAt: shipments.settledAt,
      events: shipments.events,
      createdAt: shipments.createdAt,
      orderId: shipments.orderId,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      // العنوان jsonb — بناخد المدينة منه بدل ما نجيب الكائن كله
      city: sql<string | null>`${orders.shippingAddress}->>'city'`,
    })
    .from(shipments)
    .innerJoin(orders, eq(orders.id, shipments.orderId))
    .where(eq(shipments.storeId, store.id))
    .orderBy(desc(shipments.createdAt))
    .limit(300)

  /**
   * الطلبات المستحقّة للشحن.
   *
   * الطلب المؤكّد اللي لسه مالوش شحنة هو أكتر حاجة بتتنسي في اليوم
   * المزحوم — والعميل بيبقى دافع ومستني. بنعرضهم فوق عشان التاجر
   * يشحنهم من هنا من غير ما يفتح كل طلب لوحده.
   */
  const shipped = db
    .select({ id: shipments.orderId })
    .from(shipments)
    .where(eq(shipments.storeId, store.id))

  const pending = (await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      city: sql<string | null>`${orders.shippingAddress}->>'city'`,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      paymentStatus: orders.paymentStatus,
    })
    .from(orders)
    .where(
      and(
        eq(orders.storeId, store.id),
        inArray(orders.status, ['confirmed', 'processing']),
        notInArray(orders.id, shipped),
      ),
    )
    .orderBy(desc(orders.createdAt))
    .limit(50)) as PendingOrder[]

  /**
   * الفلوس اللي لسه عند شركات الشحن.
   *
   * اتسلّمت + الدفع عند الاستلام + لسه ما اتحصّلش. ده الرقم اللي
   * التاجر بيطالب بيه الشركة، ومن غيره بيصدّق كشفها على عماه.
   */
  const [outstanding] = await db
    .select({
      amount: sql<number>`coalesce(sum(${shipments.codAmount}), 0)`,
      count: sql<number>`count(*)`,
    })
    .from(shipments)
    .where(
      and(
        eq(shipments.storeId, store.id),
        eq(shipments.status, 'delivered'),
        eq(shipments.isCodCollected, false),
        isNull(shipments.settledAt),
      ),
    )

  const inTransit = rows.filter(
    (r) => !['delivered', 'failed', 'returned'].includes(r.status),
  ).length
  const failed = rows.filter((r) => ['failed', 'returned'].includes(r.status)).length

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="الشحنات"
        description="سجّل بوليصة كل طلب، تابع حالتها، وشوف فلوسك اللي لسه عند شركة الشحن."
      />

      <Reveal>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="في الطريق" value={String(inTransit)} hint="لسه ما اتسلّمتش" />
          <Stat
            label="فلوس عند شركة الشحن"
            value={formatMoney(Number(outstanding?.amount ?? 0), store.currency)}
            hint={`${Number(outstanding?.count ?? 0)} شحنة اتسلّمت ولسه ما اتحصّلتش`}
            highlight={Number(outstanding?.amount ?? 0) > 0}
          />
          <Stat
            label="فشل أو رجع"
            value={String(failed)}
            hint={failed > 0 ? 'راجعها — دي خسارة شحن' : 'مافيش'}
          />
        </div>
      </Reveal>

      {rows.length === 0 && pending.length === 0 ? (
        <Reveal>
          <Card className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <Truck className="h-10 w-10 text-[var(--fg-subtle)]" aria-hidden="true" />
            <h2 className="text-lg font-semibold">مافيش شحنات لسه</h2>
            <p className="max-w-sm text-sm text-[var(--fg-muted)]">
              أول ما يبقى عندك طلب مؤكّد، هيظهر هنا عشان تسجّل بوليصته وتتابعها.
            </p>
          </Card>
        </Reveal>
      ) : (
        <Reveal>
          <ShipmentsManager
            shipments={rows as ShipmentRow[]}
            pending={pending}
            currency={store.currency}
            autoCarrier={autoCarrierName}
          />
        </Reveal>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string
  value: string
  hint: string
  highlight?: boolean
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs text-[var(--fg-muted)]">{label}</span>
      <span
        className="tabular text-xl font-bold"
        style={highlight ? { color: 'var(--color-warning)' } : undefined}
      >
        {value}
      </span>
      <span className="text-xs text-[var(--fg-subtle)]">{hint}</span>
    </Card>
  )
}
