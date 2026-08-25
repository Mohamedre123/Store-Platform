import Image from 'next/image'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orderItems, orders } from '@/db/schema'
import { getStore, getStoreTheme } from '@/lib/storefront'
import { getCurrentCustomer } from '@/lib/customer-auth'
import { CustomerLoginForm } from '../../../account/login-form'
import { formatMoney, formatDateTime } from '@/lib/utils'
import { PrintButton } from './print-button'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'الفاتورة' }

/**
 * فاتورة الطلب — صفحة لا مرفق.
 *
 * ## ليه صفحة
 * الفاتورة كانت بتتبعت في البريد بس، والبريد اختياري في الشيك أوت.
 * وأغلب اللي بيشتري من الفون في السوق ده بيسيب خانة البريد فاضية —
 * فالطلب بيتم ومحدّش بياخد فاتورة أصلًا. الرابط بيتبعت على الواتساب
 * كمان، والواتساب معانا رقمه إجباريًا.
 *
 * ## ليه بالخيارات
 * المقاس واللون جزء من اللي اتباع. الفاتورة اللي مكتوب فيها «تيشيرت»
 * وبس، العميل ما يقدرش يراجع بيها إنه طلب مقاسه، والتاجر ما يقدرش
 * يثبت بيها إنه بعت اللي اتطلب. ولما يحصل خلاف على مرتجع، الورقة دي
 * هي المرجع.
 *
 * ## الإذن
 * نفس قاعدة صفحة الطلب: الرمز في الرابط **و** الحساب المسجّل. الرمز
 * لوحده بيتنقل مع الرسالة، وأي حد توصله كان هيشوف عنوان العميل
 * وتليفونه.
 */
export default async function InvoicePage({
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

  if (!order || order.isIncomplete) notFound()
  if (!t || t !== order.recoveryToken) notFound()

  const customer = await getCurrentCustomer(store.id)

  if (!customer) {
    return (
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6 sm:py-16">
        <div className="mb-8 flex flex-col gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">سجّل دخولك عشان تشوف فاتورتك</h1>
          <p className="text-sm opacity-65">
            الفاتورة فيها بياناتك، فمقفولة على حسابك.
          </p>
        </div>

        <CustomerLoginForm
          storeIdentifier={identifier}
          redirectTo={`/order/${orderNumber}/invoice?t=${encodeURIComponent(t)}`}
          compact
        />
      </div>
    )
  }

  if (order.customerId && order.customerId !== customer.id) notFound()

  const [items, theme] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)),
    getStoreTheme(store.id),
  ])

  const address = order.shippingAddress
  const addressText =
    [address?.street, address?.building, address?.area, address?.city].filter(Boolean).join('، ') ||
    null

  const paid = order.paymentStatus === 'paid'

  const row = (label: string, value: string, strong = false) => (
    <div
      className={`flex items-center justify-between gap-4 ${
        strong ? 'border-t border-[var(--sf-text)]/15 pt-3 text-base font-bold' : 'text-sm'
      }`}
    >
      <span className={strong ? '' : 'opacity-65'}>{label}</span>
      <span className="tabular whitespace-nowrap">{value}</span>
    </div>
  )

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
      {/*
        الترويسة والأزرار مش جزء من الورقة المطبوعة — `print:hidden`
        بيشيلهم. العميل اللي بيطبع الفاتورة عايز الفاتورة، مش زرار
        «اطبع» متصوّر جوّاها.
      */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">فاتورة الطلب</h1>
        <PrintButton />
      </div>

      <article className="overflow-hidden rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 bg-[var(--sf-surface)] print:border-0">
        {/* رأس الفاتورة — هوية التاجر، مش هوية المنصة */}
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--sf-text)]/12 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            {store.logoLight ? (
              <span className="relative h-10 w-28 shrink-0">
                <Image
                  src={store.logoLight}
                  alt={store.name}
                  fill
                  sizes="112px"
                  className="object-contain object-right"
                />
              </span>
            ) : (
              <span className="text-lg font-bold">{store.name}</span>
            )}
          </div>

          <div className="text-end">
            <p className="text-xs opacity-60">فاتورة رقم</p>
            <p className="tabular text-xl font-bold" style={{ color: theme.custom.identity.primary }}>
              #{order.orderNumber}
            </p>
            <p className="mt-0.5 text-xs opacity-60">{formatDateTime(order.createdAt)}</p>
          </div>
        </header>

        {/* بيانات العميل */}
        <section className="grid gap-4 border-b border-[var(--sf-text)]/12 p-5 text-sm sm:grid-cols-2 sm:p-6">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium opacity-60">فاتورة إلى</span>
            <span className="font-medium">{order.customerName || 'عميل'}</span>
            {order.customerPhone && (
              <bdi dir="ltr" className="opacity-70">
                {order.customerPhone}
              </bdi>
            )}
            {order.customerEmail && <span className="opacity-70">{order.customerEmail}</span>}
            {addressText && <span className="opacity-70">{addressText}</span>}
          </div>

          <div className="flex flex-col gap-1 sm:text-end">
            <span className="text-xs font-medium opacity-60">حالة الدفع</span>
            <span className={`font-medium ${paid ? 'text-green-600' : 'text-amber-600'}`}>
              {paid ? 'مدفوعة' : 'مستحقّة الدفع'}
            </span>
            {order.paymentMethod && (
              <span className="opacity-70">
                {order.paymentMethod === 'cod' ? 'الدفع عند الاستلام' : 'دفع أونلاين'}
              </span>
            )}
          </div>
        </section>

        {/*
          الجدول بيتمدّد أفقيًا لوحده على الفون بدل ما يزقّ الصفحة كلها.
          فاتورة بتخلّي الصفحة تتحرك يمين وشمال بتبان مكسورة.
        */}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[30rem] text-sm">
            <thead>
              <tr className="border-b border-[var(--sf-text)]/12 text-xs opacity-60">
                <th scope="col" className="p-4 text-start font-medium sm:px-6">
                  الصنف
                </th>
                <th scope="col" className="p-4 text-center font-medium">
                  الكمية
                </th>
                <th scope="col" className="p-4 text-end font-medium">
                  السعر
                </th>
                <th scope="col" className="p-4 text-end font-medium sm:px-6">
                  الإجمالي
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className="border-b border-[var(--sf-text)]/8 align-top">
                  <td className="p-4 sm:px-6">
                    <span className="block font-medium leading-snug">{i.name}</span>

                    {/* الخيارات مفكوكة — دي اللي بتخلّي الفاتورة تنفع مرجعًا */}
                    {i.options.length > 0 && (
                      <span className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs opacity-65">
                        {i.options.map((o) => (
                          <span key={`${o.name}-${o.value}`}>
                            {o.name}: <span className="font-medium opacity-100">{o.value}</span>
                          </span>
                        ))}
                      </span>
                    )}

                    {i.sku && (
                      <span className="mt-0.5 block text-xs opacity-50">
                        <bdi dir="ltr">{i.sku}</bdi>
                      </span>
                    )}
                  </td>
                  <td className="tabular p-4 text-center">{i.quantity}</td>
                  <td className="tabular p-4 text-end whitespace-nowrap">
                    {formatMoney(i.price, order.currency)}
                  </td>
                  <td className="tabular p-4 text-end font-medium whitespace-nowrap sm:px-6">
                    {formatMoney(i.total, order.currency)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <section className="flex justify-end p-5 sm:p-6">
          <div className="flex w-full max-w-xs flex-col gap-2">
            {row('المنتجات', formatMoney(order.subtotal, order.currency))}
            {order.discountTotal > 0 &&
              row('الخصم', `− ${formatMoney(order.discountTotal, order.currency)}`)}
            {row(
              'الشحن',
              order.shippingTotal > 0 ? formatMoney(order.shippingTotal, order.currency) : 'مجاني',
            )}
            {order.codFee > 0 &&
              row('رسوم الدفع عند الاستلام', formatMoney(order.codFee, order.currency))}
            {order.taxTotal > 0 && row('الضريبة', formatMoney(order.taxTotal, order.currency))}
            {row('الإجمالي', formatMoney(order.total, order.currency), true)}
          </div>
        </section>

        <footer className="border-t border-[var(--sf-text)]/12 p-5 text-center text-xs opacity-60 sm:p-6">
          شكرًا إنك اشتريت من {store.name}
          {store.email && <span> · {store.email}</span>}
        </footer>
      </article>
    </div>
  )
}
