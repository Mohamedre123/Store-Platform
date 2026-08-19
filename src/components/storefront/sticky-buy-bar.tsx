'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useCart } from './cart'
import { formatMoney } from '@/lib/utils'

/**
 * شريط الشراء الثابت على الموبايل.
 *
 * صفحة المنتج على الموبايل طويلة — العميل بينزل يقرا الوصف والمراجعات
 * وزرار الشراء بيبقى فوق برّه الشاشة. الشريط ده بيخلّيه في متناوله
 * دايمًا من غير ما يرجّع لفوق.
 *
 * بيظهر بعد ما الزرار الأصلي يخرج من الشاشة بس — قبل كده هيبقى تكرارًا
 * مزعجًا لحاجة العميل شايفها.
 */
export function StickyBuyBar({
  item,
  soldOut,
  currency,
  hasMobileNav,
}: {
  item: {
    productId: string
    variantId?: string
    name: string
    slug: string
    image?: string
    price: number
    maxStock?: number
  }
  soldOut: boolean
  currency: string
  /** فيه شريط تنقّل سفلي؟ نرفع الشريط فوقه بدل ما يغطّيه */
  hasMobileNav: boolean
}) {
  const { add, setOpen, mode } = useCart()
  const [visible, setVisible] = useState(false)
  const [added, setAdded] = useState(false)

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 520)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (soldOut) return null

  return (
    <div
      className="fixed inset-x-0 z-30 border-t border-[var(--sf-text)]/10 bg-[var(--sf-surface)]/95 p-3 backdrop-blur-md transition-transform duration-300 md:hidden"
      style={{
        bottom: hasMobileNav ? '4rem' : 0,
        paddingBottom: hasMobileNav ? undefined : 'max(0.75rem, env(safe-area-inset-bottom))',
        transform: visible ? 'translateY(0)' : 'translateY(120%)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <span className="block truncate text-xs opacity-65">{item.name}</span>
          <span className="tabular block font-bold text-[var(--sf-primary)]">
            {formatMoney(item.price, currency)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            add(item, 1)
            // الدرج بيأكّد الإضافة بنفسه؛ في وضع الصفحة الزرار
            // لازم يأكّد مكانه — من غير كده العميل يدوس تاني
            if (mode === 'drawer') setOpen(true)
            else {
              setAdded(true)
              setTimeout(() => setAdded(false), 2000)
            }
          }}
          className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-6 font-semibold text-white"
        >
          {added ? (
            <>
              <Check className="h-4 w-4" aria-hidden="true" />
              اتضاف
            </>
          ) : (
            'أضف للسلة'
          )}
        </button>
      </div>
    </div>
  )
}
