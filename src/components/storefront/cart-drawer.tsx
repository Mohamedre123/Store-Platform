'use client'

import { SLink as Link } from './store-link'
import { ShoppingBag, X } from 'lucide-react'
import { useEffect } from 'react'
import { useCart } from './cart'
import { CartLines, CartNoteField, CartUpsell, FreeShippingProgress } from './cart-parts'
import { formatMoney } from '@/lib/utils'
import type { UpsellProduct } from '@/lib/storefront'

/** درج السلة — يفتح من جهة البداية ويقفل بـEscape أو بالضغط برّه */
export function CartDrawer({
  currency,
  emptyMessage = 'سلتك فاضية',
  freeShippingBar = false,
  freeOver = 0,
  showNotes = false,
  upsell = [],
  upsellTitle = 'أكمل طلبك',
}: {
  currency: string
  storeSlug: string
  emptyMessage?: string
  freeShippingBar?: boolean
  /** حد الشحن المجاني بالوحدة الصغرى */
  freeOver?: number
  showNotes?: boolean
  upsell?: UpsellProduct[]
  upsellTitle?: string
}) {
  const { items, isOpen, setOpen, subtotal, count } = useCart()

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    // منع تمرير الصفحة ورا الدرج
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [isOpen, setOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="سلة التسوق">
      <button
        type="button"
        aria-label="إغلاق السلة"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-black/50"
      />

      <div className="absolute inset-y-0 start-0 flex w-[min(26rem,92vw)] flex-col bg-[var(--sf-surface)] shadow-2xl">
        <div className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--sf-text)]/10 px-4">
          <h2 className="font-bold">
            السلة {count > 0 && <span className="tabular opacity-60">({count})</span>}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="إغلاق"
            className="flex h-10 w-10 items-center justify-center rounded-lg transition-colors hover:bg-[var(--sf-text)]/6"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <ShoppingBag className="h-10 w-10 opacity-25" aria-hidden="true" />
            <p className="font-medium">{emptyMessage}</p>
            <Link
              href="/products"
              onClick={() => setOpen(false)}
              className="mt-2 rounded-lg bg-[var(--sf-primary)] px-5 py-2.5 text-sm font-semibold text-white"
            >
              تصفّح المنتجات
            </Link>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto">
              <CartLines currency={currency} onNavigate={() => setOpen(false)} />
              <CartUpsell products={upsell} title={upsellTitle} currency={currency} />
            </div>

            <div className="safe-bottom shrink-0 border-t border-[var(--sf-text)]/10 p-4">
              {freeShippingBar && (
                <div className="mb-3">
                  <FreeShippingProgress subtotal={subtotal} freeOver={freeOver} currency={currency} />
                </div>
              )}

              <CartNoteField active={showNotes && isOpen} />

              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm opacity-70">الإجمالي</span>
                <span className="tabular text-lg font-bold">{formatMoney(subtotal, currency)}</span>
              </div>
              <p className="mb-3 text-xs opacity-55">الشحن بيتحسب في الخطوة الجاية.</p>
              <Link
                href="/checkout"
                onClick={() => setOpen(false)}
                className="flex min-h-12 w-full items-center justify-center rounded-xl bg-[var(--sf-primary)] px-5 font-semibold text-white transition-opacity hover:opacity-90"
              >
                إتمام الطلب
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
