import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { and, asc, eq } from 'drizzle-orm'
import { ArrowRight, MapPin, MessageCircle, Phone, StickyNote, User } from 'lucide-react'
import { db } from '@/db'
import { orderEvents, orderItems, orders } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { formatMoney, formatDateTime } from '@/lib/utils'
import { statusMeta } from '@/lib/order-status'
import { Card } from '@/components/ui'
import { Reveal } from '@/components/motion'
import { OrderNote, StatusControls } from '../status-controls'

export const metadata = { title: 'تفاصيل الطلب' }

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { store } = await getDashboardContext()

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.storeId, store.id)))
    .limit(1)

  if (!order) notFound()

  const [items, events] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    db
      .select()
      .from(orderEvents)
      .where(eq(orderEvents.orderId, order.id))
      .orderBy(asc(orderEvents.createdAt)),
  ])

  const meta = statusMeta(order.isIncomplete ? 'incomplete' : order.status)
  const address = order.shippingAddress

  /** الربح الحقيقي بعد تكلفة البضاعة والشحن — مش الإيراد */
  const profit = order.total - order.costTotal - order.shippingTotal

  const contactName = order.customerName ? ' ' + order.customerName : ''
  const whatsappText = order.isIncomplete
    ? `مرحبًا${contactName}، شفنا إنك كنت بتطلب من ${store.name} وما كمّلتش الطلب. تحب نساعدك؟`
    : `مرحبًا${contactName}، بخصوص طلبك رقم ${order.orderNumber} من ${store.name}`

  return (
    <div className="flex flex-col gap-6">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/orders"
            aria-label="رجوع"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <h1 className="tabular text-2xl font-bold tracking-tight">#{order.orderNumber}</h1>
          <span
            className="rounded-md px-2.5 py-1 text-sm font-medium"
            style={{ background: meta.bg, color: meta.fg }}
          >
            {meta.label}
          </span>
          <span className="text-sm text-[var(--fg-subtle)]">{formatDateTime(order.createdAt)}</span>
        </div>
      </Reveal>

      {order.isIncomplete && (
        <Reveal delay={40}>
          <Card className="border-[var(--color-warning)] bg-[var(--color-warning-soft)] p-4">
            <p className="text-sm font-semibold text-[var(--color-warning)]">
              العميل كتب رقمه وما كمّلش الطلب
            </p>
            <p className="mt-1 text-sm text-[var(--fg-muted)]">
              اتحفظ لحظة ما كتب رقمه في الشيك أوت. كلّمه — دي فلوس على وشك تضيع.
            </p>
          </Card>
        </Reveal>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-6">
          {/* البنود */}
          <Reveal delay={60}>
            <Card className="overflow-hidden">
              <div className="border-b border-[var(--border)] px-5 py-4">
                <h2 className="font-semibold">المنتجات</h2>
              </div>
              <ul className="divide-y divide-[var(--border)]">
                {items.map((i) => (
                  <li key={i.id} className="flex items-center gap-3 p-4">
                    <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-[var(--surface-2)]">
                      {i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-cover" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{i.name}</span>
                      <span className="tabular text-xs text-[var(--fg-subtle)]">
                        {formatMoney(i.price, order.currency)} × {i.quantity}
                      </span>
                    </span>
                    <span className="tabular shrink-0 font-medium">
                      {formatMoney(i.total, order.currency)}
                    </span>
                  </li>
                ))}
              </ul>

              <dl className="flex flex-col gap-2 border-t border-[var(--border)] p-5 text-sm">
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-muted)]">المنتجات</dt>
                  <dd className="tabular">{formatMoney(order.subtotal, order.currency)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-[var(--fg-muted)]">الشحن</dt>
                  <dd className="tabular">{formatMoney(order.shippingTotal, order.currency)}</dd>
                </div>
                {order.codFee > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-[var(--fg-muted)]">رسوم الدفع عند الاستلام</dt>
                    <dd className="tabular">{formatMoney(order.codFee, order.currency)}</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-[var(--border)] pt-2 text-base font-bold">
                  <dt>الإجمالي</dt>
                  <dd className="tabular">{formatMoney(order.total, order.currency)}</dd>
                </div>

                {order.costTotal > 0 && (
                  <div className="mt-2 flex justify-between rounded-lg bg-[var(--surface-2)] px-3 py-2">
                    <dt className="text-[var(--fg-muted)]">ربحك من الطلب ده</dt>
                    <dd
                      className={`tabular font-bold ${
                        profit > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'
                      }`}
                    >
                      {formatMoney(profit, order.currency)}
                    </dd>
                  </div>
                )}
              </dl>
            </Card>
          </Reveal>

          {/* المسار الزمني */}
          <Reveal delay={100}>
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="font-semibold">المسار الزمني</h2>
              <ol className="flex flex-col gap-3">
                {events.map((e) => (
                  <li key={e.id} className="flex gap-3">
                    <span
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--primary)]"
                      aria-hidden="true"
                    />
                    <span className="flex-1">
                      <span className="block text-sm">{e.message}</span>
                      <span className="block text-xs text-[var(--fg-subtle)]">
                        {formatDateTime(e.createdAt)}
                      </span>
                    </span>
                  </li>
                ))}
              </ol>
              <OrderNote orderId={order.id} />
            </Card>
          </Reveal>
        </div>

        {/* الجانب */}
        <div className="flex flex-col gap-6">
          <Reveal delay={80}>
            <StatusControls orderId={order.id} status={order.status} isIncomplete={order.isIncomplete} />
          </Reveal>

          <Reveal delay={120}>
            <Card className="flex flex-col gap-4 p-5">
              <h2 className="font-semibold">العميل</h2>

              <div className="flex flex-col gap-2.5 text-sm">
                <span className="flex items-center gap-2">
                  <User className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
                  {order.customerName || 'بدون اسم'}
                </span>

                {order.customerPhone && (
                  <span className="flex items-center gap-2">
                    <Phone className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
                    <bdi dir="ltr">{order.customerPhone}</bdi>
                  </span>
                )}

                {address && (
                  <span className="flex items-start gap-2">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
                    <span className="text-[var(--fg-muted)]">
                      {[address.city, address.area, address.street, address.building]
                        .filter(Boolean)
                        .join(' — ') || 'بدون عنوان'}
                    </span>
                  </span>
                )}

                {order.notes && (
                  <span className="flex items-start gap-2">
                    <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
                    <span className="text-[var(--fg-muted)]">{order.notes}</span>
                  </span>
                )}
              </div>

              {order.customerPhone && (
                <div className="flex gap-2">
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border border-[var(--border-strong)] text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
                  >
                    <Phone className="h-4 w-4" aria-hidden="true" />
                    اتصال
                  </a>
                  <a
                    href={`https://wa.me/${order.customerPhone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(whatsappText)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--color-success)] text-sm font-semibold text-white transition-opacity hover:opacity-90"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    واتساب
                  </a>
                </div>
              )}
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  )
}
