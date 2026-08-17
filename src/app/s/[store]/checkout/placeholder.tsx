'use client'

import Link from 'next/link'
import { MessageCircle, ShoppingBag } from 'lucide-react'
import { useCart } from '@/components/storefront/cart'
import { formatMoney } from '@/lib/utils'

/**
 * الشيك أوت لسه تحت الإنشاء.
 *
 * بدل ما العميل يلاقي صفحة مكسورة بعد ما ملأ سلته، بنعرض عليه طلب
 * عبر واتساب بمحتوى السلة جاهزًا — فالطلب ما يضيعش لحد ما ننزّل
 * الشيك أوت الكامل.
 */
export function CheckoutPlaceholder({
  currency,
  whatsapp,
  storeName,
}: {
  currency: string
  whatsapp: string | null
  storeName: string
}) {
  const { items, subtotal, count } = useCart()

  if (count === 0) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
        <ShoppingBag className="h-10 w-10 opacity-25" aria-hidden="true" />
        <h1 className="text-xl font-bold">سلتك فاضية</h1>
        <Link
          href="/products"
          className="rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-5 py-3 font-semibold text-white"
        >
          تصفّح المنتجات
        </Link>
      </div>
    )
  }

  const message = [
    `طلب من ${storeName}:`,
    '',
    ...items.map((i) => `• ${i.name} × ${i.quantity} — ${formatMoney(i.price * i.quantity, currency)}`),
    '',
    `الإجمالي: ${formatMoney(subtotal, currency)}`,
  ].join('\n')

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">مراجعة الطلب</h1>

      <ul className="mt-6 divide-y divide-[var(--sf-text)]/10 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/10">
        {items.map((i) => (
          <li key={`${i.productId}-${i.variantId ?? ''}`} className="flex items-center justify-between gap-3 p-4">
            <span className="min-w-0">
              <span className="block truncate font-medium">{i.name}</span>
              <span className="tabular text-sm opacity-60">الكمية: {i.quantity}</span>
            </span>
            <span className="tabular shrink-0 font-bold">{formatMoney(i.price * i.quantity, currency)}</span>
          </li>
        ))}
        <li className="flex items-center justify-between p-4">
          <span className="font-bold">الإجمالي</span>
          <span className="tabular text-lg font-bold text-[var(--sf-primary)]">
            {formatMoney(subtotal, currency)}
          </span>
        </li>
      </ul>

      <div className="mt-6 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/10 bg-[var(--sf-text)]/4 p-4">
        <p className="text-sm leading-relaxed opacity-75">
          صفحة الدفع بتتجهّز دلوقتي. لحد ما تجهز، ابعت طلبك على واتساب وهيوصل للمتجر بكل تفاصيله.
        </p>
      </div>

      {whatsapp ? (
        <a
          href={`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 flex min-h-13 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-6 font-semibold text-white"
        >
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
          أكمل الطلب على واتساب
        </a>
      ) : (
        <p className="mt-4 text-sm opacity-65">
          المتجر لسه ما أضافش رقم واتساب. ارجع بعدين أو كلّم صاحب المتجر.
        </p>
      )}

      <Link
        href="/products"
        className="mt-3 flex min-h-12 w-full items-center justify-center rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 px-6 font-medium"
      >
        كمّل تسوّق
      </Link>
    </div>
  )
}
