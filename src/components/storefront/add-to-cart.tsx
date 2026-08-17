'use client'

import { useState } from 'react'
import { Check, Minus, Plus, ShoppingBag } from 'lucide-react'
import { useCart, type CartItem } from './cart'

/**
 * زر الإضافة للسلة.
 *
 * بيتحوّل لـ«اتضاف ✓» ثانيتين بعد الضغط — تأكيد فوري في نفس المكان
 * اللي العميل بيبص فيه، بدل ما يستنى الدرج يفتح عشان يعرف إن الطلب نجح.
 */
export function AddToCart({
  item,
  soldOut,
  whatsapp,
  productName,
}: {
  item: Omit<CartItem, 'quantity'>
  soldOut: boolean
  whatsapp?: string | null
  productName: string
}) {
  const { add } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)

  const max = item.maxStock ?? 99

  if (soldOut) {
    return (
      <button
        type="button"
        disabled
        className="flex min-h-13 w-full cursor-not-allowed items-center justify-center rounded-[var(--sf-radius)] bg-[var(--sf-text)]/10 px-6 font-semibold opacity-60"
      >
        نفدت الكمية
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <span className="text-sm opacity-70">الكمية</span>
        <div className="flex items-center rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            aria-label="تقليل الكمية"
            className="flex h-11 w-11 items-center justify-center"
          >
            <Minus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className="tabular w-10 text-center font-medium">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(max, q + 1))}
            disabled={quantity >= max}
            aria-label="زيادة الكمية"
            className="flex h-11 w-11 items-center justify-center disabled:opacity-35"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          add(item, quantity)
          setAdded(true)
          setTimeout(() => setAdded(false), 2000)
        }}
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-6 font-semibold text-white transition-opacity hover:opacity-90"
      >
        {added ? (
          <>
            <Check className="h-5 w-5" aria-hidden="true" />
            اتضاف للسلة
          </>
        ) : (
          <>
            <ShoppingBag className="h-5 w-5" aria-hidden="true" />
            أضف للسلة
          </>
        )}
      </button>

      {whatsapp && (
        <a
          href={`https://wa.me/${whatsapp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
            `مرحبًا، عايز أستفسر عن: ${productName}`,
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 px-6 font-medium transition-colors hover:bg-[var(--sf-text)]/5"
        >
          اسأل على واتساب
        </a>
      )}
    </div>
  )
}
