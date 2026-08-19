'use client'

import { SLink as Link } from '@/components/storefront/store-link'
import { ShoppingBag } from 'lucide-react'
import { useCart } from '@/components/storefront/cart'
import {
  CartLines,
  CartNoteField,
  CartUpsell,
  FreeShippingProgress,
} from '@/components/storefront/cart-parts'
import { formatMoney } from '@/lib/utils'
import type { UpsellProduct } from '@/lib/storefront'

/**
 * صفحة السلة الكاملة.
 *
 * بديل الدرج لما التاجر يختار وضع «صفحة». الدرج أسرع لكن الصفحة
 * ليها رابط يتبعت ويترجّعله، وبتدّي مساحة أوسع للبنود والمقترحات —
 * وده بيفرق في المتاجر اللي متوسط السلة فيها كذا منتج.
 *
 * السلة نفسها محفوظة في المتصفح، فالصفحة لازم تكون عميلًا.
 */
export function CartPageClient({
  currency,
  emptyMessage,
  freeShippingBar,
  freeOver,
  showNotes,
  upsell,
  upsellTitle,
}: {
  currency: string
  emptyMessage: string
  freeShippingBar: boolean
  freeOver: number
  showNotes: boolean
  upsell: UpsellProduct[]
  upsellTitle: string
}) {
  const { items, subtotal, count, ready } = useCart()

  // قبل ما نقرا التخزين ما نعرضش «سلتك فاضية» — رسالة غلط لثانية
  // بتخلّي العميل يفتكر إن سلّته ضاعت
  if (!ready) return <div className="min-h-[40vh]" aria-hidden="true" />

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-24 text-center sm:px-6">
        <ShoppingBag className="h-12 w-12 opacity-25" aria-hidden="true" />
        <p className="text-lg font-medium">{emptyMessage}</p>
        <Link
          href="/products"
          className="mt-1 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-6 py-3 font-semibold text-white"
        >
          تصفّح المنتجات
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight">
        السلة <span className="tabular text-base font-normal opacity-60">({count})</span>
      </h1>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="overflow-hidden rounded-[var(--sf-radius)] border border-[var(--sf-text)]/10 bg-[var(--sf-surface)]">
          <CartLines currency={currency} compact={false} />
          <CartUpsell products={upsell} title={upsellTitle} currency={currency} />
        </div>

        <div className="rounded-[var(--sf-radius)] border border-[var(--sf-text)]/10 bg-[var(--sf-surface)] p-4 lg:sticky lg:top-20">
          {freeShippingBar && (
            <div className="mb-4">
              <FreeShippingProgress subtotal={subtotal} freeOver={freeOver} currency={currency} />
            </div>
          )}

          <CartNoteField active={showNotes} />

          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm opacity-70">الإجمالي</span>
            <span className="tabular text-lg font-bold">{formatMoney(subtotal, currency)}</span>
          </div>
          <p className="mb-4 text-xs opacity-55">الشحن بيتحسب في الخطوة الجاية.</p>

          <Link
            href="/checkout"
            className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--sf-primary)] px-5 font-semibold text-white transition-opacity hover:opacity-90"
          >
            إتمام الطلب
          </Link>
          <Link
            href="/products"
            className="mt-2 flex min-h-11 w-full items-center justify-center text-sm opacity-70 transition-opacity hover:opacity-100"
          >
            كمّل تسوّق
          </Link>
        </div>
      </div>
    </div>
  )
}
