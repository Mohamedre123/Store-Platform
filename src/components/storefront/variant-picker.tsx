'use client'

import { useMemo, useState } from 'react'
import { AddToCart } from './add-to-cart'
import type { QuickCheckoutSettings } from './quick-checkout'
import { formatMoney } from '@/lib/utils'

export type PickerOption = {
  id: string
  name: string
  displayAs: 'swatch' | 'button' | 'dropdown'
  values: Array<{ id: string; value: string; hex: string | null }>
}

export type PickerVariant = {
  id: string
  title: string
  price: number
  compareAtPrice: number | null
  stock: number
  image: string | null
  optionValueIds: string[]
}

/**
 * اختيار المتغيّر (المقاس/اللون) قبل الإضافة للسلة.
 *
 * المنتج اللي ليه متغيّرات، سعره ومخزونه بيجوا من المتغيّر المختار لا
 * من المنتج نفسه. من غير ده، عميل يشتري «أحمر XL» ويستلم حاجة تانية —
 * أو يشتري مقاس مفيش منه حاجة في المخزن.
 *
 * القيمة اللي مفيش منها أي متغيّر متاح بتتعطّل بدل ما تتخفي: العميل
 * لازم يعرف إن المقاس ده موجود بس نافد، مش إنه مش موجود أصلًا.
 */
export function VariantPicker({
  options,
  variants,
  fallback,
  currency,
  whatsapp,
  whatsappOrder,
  productUrl,
  showStockCounter,
  quick,
}: {
  options: PickerOption[]
  variants: PickerVariant[]
  /** بيانات المنتج نفسه — تُستخدم لو مفيش متغيّر مختار */
  fallback: { productId: string; name: string; slug: string; image?: string; price: number }
  currency: string
  whatsapp?: string | null
  /** رقم الطلب على واتساب ورابط المنتج — بيتمرّروا لزرار الإضافة */
  whatsappOrder?: string | null
  productUrl?: string | null
  showStockCounter: boolean
  /** إعدادات الدفع السريع — بتتمرّر لزرار الإضافة عشان ياخد المتغيّر المختار */
  quick?: QuickCheckoutSettings | null
}) {
  // نبدأ بأول متغيّر متاح — العميل يلاقي اختيارًا صالحًا قدامه
  const firstAvailable = variants.find((v) => v.stock > 0) ?? variants[0]
  const [selectedValues, setSelectedValues] = useState<string[]>(
    firstAvailable?.optionValueIds ?? [],
  )

  const selected = useMemo(() => {
    if (selectedValues.length !== options.length) return null
    return (
      variants.find(
        (v) =>
          v.optionValueIds.length === selectedValues.length &&
          selectedValues.every((id) => v.optionValueIds.includes(id)),
      ) ?? null
    )
  }, [selectedValues, variants, options.length])

  /** هل فيه متغيّر متاح لو اخترنا القيمة دي؟ */
  function valueAvailable(optionIndex: number, valueId: string) {
    const trial = [...selectedValues]
    trial[optionIndex] = valueId
    return variants.some(
      (v) => v.stock > 0 && trial.every((id) => !id || v.optionValueIds.includes(id)),
    )
  }

  function pick(optionIndex: number, valueId: string) {
    const next = [...selectedValues]
    next[optionIndex] = valueId
    setSelectedValues(next)
  }

  const price = selected?.price ?? fallback.price
  const compareAt = selected?.compareAtPrice ?? null
  const stock = selected?.stock ?? 0
  const soldOut = variants.length > 0 && (!selected || stock <= 0)

  return (
    <div className="flex flex-col gap-5">
      {/* السعر بيتحدّث مع المتغيّر المختار */}
      <div className="flex flex-wrap items-baseline gap-3">
        <span className="tabular text-3xl font-bold text-[var(--sf-primary)]">
          {formatMoney(price, currency)}
        </span>
        {compareAt && compareAt > price && (
          <span className="tabular text-lg line-through opacity-45">
            {formatMoney(compareAt, currency)}
          </span>
        )}
      </div>

      {options.map((option, i) => (
        <div key={option.id} className="flex flex-col gap-2">
          <span className="text-sm font-medium">
            {option.name}
            {selectedValues[i] && (
              <span className="opacity-60">
                {' — '}
                {option.values.find((v) => v.id === selectedValues[i])?.value}
              </span>
            )}
          </span>

          <div className="flex flex-wrap gap-2">
            {option.values.map((value) => {
              const active = selectedValues[i] === value.id
              const available = valueAvailable(i, value.id)

              if (option.displayAs === 'swatch' && value.hex) {
                return (
                  <button
                    key={value.id}
                    type="button"
                    onClick={() => pick(i, value.id)}
                    disabled={!available}
                    aria-label={value.value}
                    aria-pressed={active}
                    title={available ? value.value : `${value.value} — نفدت`}
                    className={`relative h-10 w-10 rounded-full border-2 transition-all ${
                      active ? 'border-[var(--sf-primary)] scale-110' : 'border-[var(--sf-text)]/20'
                    } ${!available ? 'opacity-35' : ''}`}
                    style={{ background: value.hex }}
                  >
                    {!available && (
                      <span
                        className="absolute inset-0 flex items-center justify-center text-lg leading-none text-white mix-blend-difference"
                        aria-hidden="true"
                      >
                        ⁄
                      </span>
                    )}
                  </button>
                )
              }

              return (
                <button
                  key={value.id}
                  type="button"
                  onClick={() => pick(i, value.id)}
                  disabled={!available}
                  aria-pressed={active}
                  className={`min-h-11 rounded-[var(--sf-radius)] border px-4 text-sm font-medium transition-colors ${
                    active
                      ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/10 text-[var(--sf-primary)]'
                      : 'border-[var(--sf-text)]/20 hover:border-[var(--sf-text)]/40'
                  } ${!available ? 'cursor-not-allowed line-through opacity-40' : ''}`}
                >
                  {value.value}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      {showStockCounter && selected && stock > 0 && stock <= 10 && (
        <p className="text-sm font-medium text-amber-600">
          باقي <span className="tabular">{stock}</span> بس من الاختيار ده
        </p>
      )}

      <AddToCart
        item={{
          productId: fallback.productId,
          variantId: selected?.id,
          // اسم المتغيّر بيتحط في السلة عشان العميل يفتكر اختار إيه
          name: selected ? `${fallback.name} — ${selected.title}` : fallback.name,
          slug: fallback.slug,
          image: selected?.image ?? fallback.image,
          price,
          maxStock: selected ? stock : undefined,
        }}
        soldOut={soldOut}
        whatsapp={whatsapp}
        whatsappOrder={whatsappOrder}
        productUrl={productUrl}
        productName={fallback.name}
        quick={quick}
      />
    </div>
  )
}
