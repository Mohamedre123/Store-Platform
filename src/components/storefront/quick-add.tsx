'use client'

import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { useCart } from './cart'

/**
 * زرار الإضافة السريعة على بطاقة المنتج.
 *
 * بيوفّر على العميل فتح صفحة المنتج لما يكون عارف هو عايز إيه — بيزوّد
 * معدّل الإضافة للسلة في متاجر المنتجات البسيطة. مقفول افتراضيًا، والتاجر
 * بيشغّله من «صفحة المنتجات» في المحرّر.
 */
export function QuickAdd({
  product,
  soldOut,
}: {
  product: { productId: string; name: string; slug: string; image?: string; price: number; maxStock?: number }
  soldOut: boolean
}) {
  const { add, setOpen } = useCart()
  const [added, setAdded] = useState(false)

  if (soldOut) return null

  return (
    <button
      type="button"
      onClick={(e) => {
        // البطاقة كلها رابط — نمنع فتح صفحة المنتج عند الضغط على الزر
        e.preventDefault()
        e.stopPropagation()
        add(product, 1)
        setAdded(true)
        setOpen(true)
        setTimeout(() => setAdded(false), 1500)
      }}
      aria-label={`أضف ${product.name} للسلة`}
      className="mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[var(--sf-radius)] border border-[var(--sf-primary)] text-sm font-semibold text-[var(--sf-primary)] transition-colors hover:bg-[var(--sf-primary)] hover:text-white"
    >
      {added ? (
        <>
          <Check className="h-4 w-4" aria-hidden="true" />
          اتضاف
        </>
      ) : (
        <>
          <Plus className="h-4 w-4" aria-hidden="true" />
          أضف للسلة
        </>
      )}
    </button>
  )
}
