import { SLink as Link } from '@/components/storefront/store-link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { CheckCircle2, Clock, FileText, MessageCircle, Package, Truck } from 'lucide-react'
import { db } from '@/db'
import { orderItems, orders, returns, thankYouSettings } from '@/db/schema'
import { getStore } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/customer-auth'
import { CustomerLoginForm } from '../../account/login-form'
import { returnStatusMeta } from '@/lib/returns-meta'
import { ReturnForm } from './return-form'
import { PayNowButton } from './pay-button'
import { paymentProvider } from '@/lib/providers'
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
  searchParams: Promise<{ t?: string; pay_error?: string }>
}) {
  const { store: identifier, number } = await params
  const { t, pay_error: payError } = await searchParams

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
   * مين يشوف الطلب ده؟
   *
   * **صاحبه المسجّل دخوله بس.** الرمز في الرابط لوحده مكانش كفاية:
   * الرابط بيتبعت في إيميل، وأي حد يفتح الإيميل — على جهاز مشترك،
   * أو بعد ما الإيميل يتحوّل — كان بيشوف اسم العميل وعنوانه
   * وتليفونه وكل طلباته.
   *
   * الرمز بيفضل شرطًا كمان: بيمنع عميل مسجّل من إنه يعدّ الأرقام
   * ويقرا طلبات عملاء تانيين لو حصل خلل في ربط الحساب.
   */
  if (!t || t !== order.recoveryToken) notFound()

  const customer = await getCurrentCustomer(store.id)

  if (!customer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8 flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">سجّل دخولك عشان تشوف طلبك</h1>
          <p className="text-sm opacity-65">
            بياناتك مقفولة على حسابك — عشان محدش غيرك يشوفها لو الرابط وصل لحد تاني.
          </p>
        </div>

        <CustomerLoginForm
          storeIdentifier={identifier}
          redirectTo={`/order/${orderNumber}?t=${encodeURIComponent(t)}`}
          compact
        />
      </div>
    )
  }

  /*
    الطلب لازم يكون بتاع الحساب اللي داخل.
    الطلبات القديمة اللي اتعملت قبل إلزام الدخول ممكن تكون بلا عميل —
    ديّ بيكفيها الرمز، وإلا كان التاجر هيخسر متابعة كل طلب قديم.
  */
  if (order.customerId && order.customerId !== customer.id) notFound()

  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id))
  const [settings] = await db
    .select()
    .from(thankYouSettings)
    .where(eq(thankYouSettings.storeId, store.id))
    .limit(1)

  // طلب إرجاع قائم — نعرض حالته بدل نموذج جديد
  const [existingReturn] = await db
    .select({ returnNumber: returns.returnNumber, status: returns.status, type: returns.type })
    .from(returns)
    .where(eq(returns.orderId, order.id))
    .limit(1)

  const stageIndex = Math.max(0, STAGES.findIndex((s) => s.key === order.status))
  const address = order.shippingAddress

  /*
    الطلب اللي اختار بوابة أونلاين ولسه ما اتدفعش لازم يلاقي طريقًا
    يكمّل بيه. الملغي والمرتجع مستثنيين — زرار دفع على طلب اتلغى
    بياخد فلوس على حاجة مش هتتشحن.
  */
  const gatewayDef = order.paymentGateway ? paymentProvider(order.paymentGateway) : undefined
  const awaitingPayment =
    Boolean(gatewayDef) &&
    order.paymentStatus !== 'paid' &&
    !['cancelled', 'returned', 'delivered'].includes(order.status)

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

      {awaitingPayment && gatewayDef && (
        <PayNowButton
          storeIdentifier={identifier}
          orderNumber={order.orderNumber}
          token={t}
          gatewayName={gatewayDef.name}
          hadError={payError === '1'}
        />
      )}

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
              <li key={i.id} className="flex items-start gap-3 p-4">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6">
                  {i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-cover" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium leading-snug">{i.name}</span>

                  {/* المقاس واللون — العميل بيراجع بيهم إنه طلب صح */}
                  {i.options.length > 0 && (
                    <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs opacity-65">
                      {i.options.map((o) => (
                        <span key={`${o.name}-${o.value}`}>
                          {o.name}: <span className="font-medium opacity-100">{o.value}</span>
                        </span>
                      ))}
                    </span>
                  )}

                  <span className="tabular mt-0.5 block text-xs opacity-60">الكمية: {i.quantity}</span>
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

      {/*
        الفاتورة في متناول إيده على طول.

        بتتبعت على الواتساب وقت التأكيد، بس الرسايل بتتوه. العميل
        اللي بيدوّر على فاتورته بيفتح صفحة طلبه — فلازم يلاقيها هنا
        من غير ما يسأل التاجر.
      */}
      <Link
        href={`/order/${order.orderNumber}/invoice?t=${encodeURIComponent(t)}`}
        className="mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 px-5 font-medium transition-colors hover:bg-[var(--sf-text)]/5"
      >
        <FileText className="h-4 w-4" aria-hidden="true" />
        اعرض الفاتورة
      </Link>

      <div className="mt-3 flex flex-col gap-3 sm:flex-row">
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

      {/* الإرجاع — بعد التسليم بس */}
      {existingReturn ? (
        <div className="mt-6 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 p-4 text-sm">
          <p className="font-semibold">
            {existingReturn.type === 'refund' ? 'طلب استرداد' : 'طلب استبدال'} #
            {existingReturn.returnNumber}
          </p>
          <p className="mt-1 opacity-70">{returnStatusMeta(existingReturn.status).label}</p>
        </div>
      ) : (
        order.status === 'delivered' && (
          <ReturnForm
            storeIdentifier={identifier}
            orderNumber={order.orderNumber}
            token={order.recoveryToken ?? ''}
            currency={order.currency}
            items={items.map((i) => ({
              id: i.id,
              name: i.name,
              quantity: i.quantity,
              price: i.price,
            }))}
          />
        )
      )}
    </div>
  )
}
