import { SLink as Link } from '@/components/storefront/store-link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { CheckCircle2, Clock, MessageCircle, Package, Truck } from 'lucide-react'
import { db } from '@/db'
import { orderItems, orders, thankYouSettings } from '@/db/schema'
import { getStore } from '@/lib/storefront'
import { formatMoney, formatDateTime } from '@/lib/utils'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'تم استلام طلبك' }

const STAGES = [
  { key: 'pending', label: 'اتسجّل' },
  { key: 'confirmed', label: 'اتأكد' },
  { key: 'shipped', label: 'اتشحن' },
  { key: 'delivered', label: 'اتسلّم' },
]

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ store: string; number: string }>
  searchParams: Promise<{ t?: string }>
}) {
  const { store: identifier, number } = await params
  const { t } = await searchParams

  const store = await getStore(identifier)
  if (!store) notFound()

  const orderNumber = Number(number)
  if (!Number.isFinite(orderNumber)) notFound()

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.orderNumber, orderNumber)))
    .limit(1)

  if (!order) notFound()

  /**
   * الطلب فيه اسم العميل وعنوانه وتليفونه — ما ينفعش يتفتح برقمه
   * وحده، وإلا أي حد يعدّ الأرقام ويقرأ بيانات العملاء. الرمز في
   * الرابط هو اللي بيثبت إن صاحب الطلب هو اللي بيفتحه.
   */
  if (!t || t !== order.recoveryToken) notFound()

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
  const [settings] = await db
    .select()
    .from(thankYouSettings)
    .where(eq(thankYouSettings.storeId, store.id))
    .limit(1)

  const stageIndex = Math.max(0, STAGES.findIndex((s) => s.key === order.status))
  const address = order.shippingAddress

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden="true" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">وصلنا طلبك</h1>
        <p className="opacity-70">
          طلب رقم <span className="tabular font-bold">#{order.orderNumber}</span> — هنكلّمك على{' '}
          <bdi dir="ltr" className="font-medium">
            {order.customerPhone}
          </bdi>{' '}
          لتأكيده
        </p>
        {settings?.customMessage && <p className="mt-1 opacity-70">{settings.customMessage}</p>}
      </div>

      {(settings?.showProgressTracker ?? true) && (
        <div className="mt-10 flex items-center">
          {STAGES.map((s, i) => (
            <div key={s.key} className="flex flex-1 flex-col items-center gap-2">
              <div className="flex w-full items-center">
                <span
                  className={`h-0.5 flex-1 ${
                    i === 0 ? 'opacity-0' : i <= stageIndex ? 'bg-[var(--sf-primary)]' : 'bg-[var(--sf-text)]/15'
                  }`}
                />
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    i <= stageIndex ? 'bg-[var(--sf-primary)] text-white' : 'bg-[var(--sf-text)]/10 opacity-60'
                  }`}
                >
                  {i + 1}
                </span>
                <span
                  className={`h-0.5 flex-1 ${
                    i === STAGES.length - 1
                      ? 'opacity-0'
                      : i < stageIndex
                        ? 'bg-[var(--sf-primary)]'
                        : 'bg-[var(--sf-text)]/15'
                  }`}
                />
              </div>
              <span className={`text-xs ${i <= stageIndex ? 'font-semibold' : 'opacity-55'}`}>{s.label}</span>
            </div>
          ))}
        </div>
      )}

      {(settings?.showOrderSummary ?? true) && (
        <div className="mt-10 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12">
          <ul className="divide-y divide-[var(--sf-text)]/10">
            {items.map((i) => (
              <li key={i.id} className="flex items-center gap-3 p-4">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6">
                  {i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{i.name}</span>
                  <span className="tabular text-xs opacity-60">الكمية: {i.quantity}</span>
                </span>
                <span className="tabular shrink-0 text-sm font-medium">
                  {formatMoney(i.total, order.currency)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="flex flex-col gap-2 border-t border-[var(--sf-text)]/10 p-4 text-sm">
            <div className="flex justify-between">
              <dt className="opacity-65">المنتجات</dt>
              <dd className="tabular">{formatMoney(order.subtotal, order.currency)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="opacity-65">الشحن</dt>
              <dd className="tabular">
                {order.shippingTotal === 0 ? (
                  <span className="text-green-600">مجاني</span>
                ) : (
                  formatMoney(order.shippingTotal, order.currency)
                )}
              </dd>
            </div>
            {order.codFee > 0 && (
              <div className="flex justify-between">
                <dt className="opacity-65">رسوم الدفع عند الاستلام</dt>
                <dd className="tabular">{formatMoney(order.codFee, order.currency)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--sf-text)]/10 pt-2 text-base font-bold">
              <dt>الإجمالي</dt>
              <dd className="tabular text-[var(--sf-primary)]">{formatMoney(order.total, order.currency)}</dd>
            </div>
          </dl>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 p-4 text-sm">
        <span className="flex items-center gap-2">
          <Truck className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
          <span className="opacity-75">
            {[address?.city, address?.area, address?.street].filter(Boolean).join(' — ') ||
              'هنتواصل معاك لتحديد العنوان'}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Package className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
          <span className="opacity-75">
            {order.paymentMethod === 'cod' ? 'الدفع عند الاستلام' : 'دفع إلكتروني'}
          </span>
        </span>
        <span className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
          <span className="opacity-75">{formatDateTime(order.createdAt)}</span>
        </span>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        {(settings?.showWhatsappButton ?? true) && store.whatsapp && (
          <a
            href={`https://wa.me/${store.whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
              `استفسار عن الطلب رقم ${order.orderNumber}`,
            )}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 px-5 font-medium"
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            تواصل معنا
          </a>
        )}
        <Link
          href="/products"
          className="flex min-h-12 flex-1 items-center justify-center rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-5 font-semibold text-white"
        >
          كمّل تسوّق
        </Link>
      </div>
    </div>
  )
}
