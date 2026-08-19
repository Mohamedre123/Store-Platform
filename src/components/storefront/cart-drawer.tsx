'use client'

import Image from 'next/image'
import { SLink as Link } from './store-link'
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCart } from './cart'
import { formatMoney } from '@/lib/utils'

/** درج السلة — يفتح من جهة البداية ويقفل بـEscape أو بالضغط برّه */
export function CartDrawer({
  currency,
  emptyMessage = 'سلتك فاضية',
  freeShippingBar = false,
  freeOver = 0,
  showNotes = false,
}: {
  currency: string
  storeSlug: string
  emptyMessage?: string
  freeShippingBar?: boolean
  /** حد الشحن المجاني بالوحدة الصغرى */
  freeOver?: number
  showNotes?: boolean
}) {
  const { items, isOpen, setOpen, setQuantity, remove, subtotal, count } = useCart()
  const [note, setNote] = useState('')

  // نقرا الملاحظة المحفوظة مرة واحدة عند الفتح
  useEffect(() => {
    if (!isOpen || !showNotes) return
    try {
      setNote(localStorage.getItem('zw_cart_note') ?? '')
    } catch {}
  }, [isOpen, showNotes])

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
            <ul className="flex-1 divide-y divide-[var(--sf-text)]/8 overflow-y-auto">
              {items.map((item) => (
                <li key={`${item.productId}-${item.variantId ?? ''}`} className="flex gap-3 p-4">
                  <Link
                    href={`/products/${item.slug}`}
                    onClick={() => setOpen(false)}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-[var(--sf-text)]/6"
                  >
                    {item.image && (
                      <Image src={item.image} alt="" fill sizes="80px" className="object-cover" />
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={() => setOpen(false)}
                      className="line-clamp-2 text-sm font-medium"
                    >
                      {item.name}
                    </Link>

                    <span className="tabular text-sm font-bold text-[var(--sf-primary)]">
                      {formatMoney(item.price, currency)}
                    </span>

                    <div className="mt-auto flex items-center justify-between gap-2">
                      <div className="flex items-center rounded-lg border border-[var(--sf-text)]/15">
                        <button
                          type="button"
                          onClick={() => setQuantity(item.productId, item.quantity - 1, item.variantId)}
                          aria-label="تقليل"
                          className="flex h-9 w-9 items-center justify-center"
                        >
                          <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <span className="tabular w-8 text-center text-sm font-medium">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => setQuantity(item.productId, item.quantity + 1, item.variantId)}
                          disabled={item.maxStock ? item.quantity >= item.maxStock : false}
                          aria-label="زيادة"
                          className="flex h-9 w-9 items-center justify-center disabled:opacity-35"
                        >
                          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => remove(item.productId, item.variantId)}
                        aria-label={`حذف ${item.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg opacity-50 transition-opacity hover:opacity-100"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>

                    {item.maxStock !== undefined && item.quantity >= item.maxStock && (
                      <span className="text-xs opacity-60">دي آخر كمية متاحة</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            <div className="safe-bottom shrink-0 border-t border-[var(--sf-text)]/10 p-4">
              {/*
                شريط الشحن المجاني.
                «فاضلك ٥٠ جنيه» بيرفع قيمة الطلب أكتر من أي خصم — العميل
                بيزوّد عشان يوصل للحد بدل ما ياخد خصمًا يقلّل هامش التاجر.
              */}
              {freeShippingBar && freeOver > 0 && (
                <div className="mb-3">
                  {subtotal >= freeOver ? (
                    <p className="text-sm font-medium text-green-600">
                      مبروك! الشحن مجاني على طلبك
                    </p>
                  ) : (
                    <>
                      <p className="mb-1.5 text-xs">
                        فاضلك{' '}
                        <span className="tabular font-bold text-[var(--sf-primary)]">
                          {formatMoney(freeOver - subtotal, currency)}
                        </span>{' '}
                        والشحن يبقى مجاني
                      </p>
                      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--sf-text)]/10">
                        <div
                          className="h-full rounded-full bg-[var(--sf-primary)] transition-[width] duration-500"
                          style={{ width: `${Math.min(100, (subtotal / freeOver) * 100)}%` }}
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {showNotes && (
                <label className="mb-3 flex flex-col gap-1.5">
                  <span className="text-xs opacity-70">ملاحظة على الطلب (اختياري)</span>
                  <textarea
                    value={note}
                    onChange={(e) => {
                      setNote(e.target.value)
                      // بتتقرا في الشيك أوت — التخزين المحلي بيخلّيها تعدّي بين الصفحتين
                      try {
                        localStorage.setItem('zw_cart_note', e.target.value)
                      } catch {}
                    }}
                    rows={2}
                    placeholder="مثال: اتصل قبل التوصيل"
                    className="rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--sf-primary)]"
                  />
                </label>
              )}

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
