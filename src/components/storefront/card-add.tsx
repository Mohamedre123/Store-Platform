'use client'

import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { useCart } from './cart'
import { OptionChips, useVariantChoice } from './option-chips'
import { formatMoney } from '@/lib/utils'
import type { ProductOptionSet } from '@/lib/product-options'

/**
 * الإضافة من على بطاقة المنتج، مع الخيارات لو المنتج ليه خيارات.
 *
 * **المنتج اللي مالوش خيارات بياخد زر الإضافة وبس.** ده مش تفصيلة:
 * المتجر الواحد فيه منتجات بمقاسات ومنتجات من غير، ولو فرضنا شكلًا
 * واحدًا على الاتنين، إمّا نضيّع مساحة على منتج بسيط، أو نضيف منتج
 * بمقاس إحنا اللي اخترناه.
 *
 * القرار بيتاخد لكل منتج لوحده من وجود خياراته — مش من إعداد التاجر.
 */
export function CardAdd({
  product,
  optionSet,
  currency,
  soldOut,
}: {
  product: {
    productId: string
    name: string
    slug: string
    image?: string
    price: number
    maxStock?: number
  }
  /** غايب = المنتج مالوش خيارات */
  optionSet?: ProductOptionSet
  currency: string
  soldOut: boolean
}) {
  if (!optionSet || optionSet.options.length === 0) {
    return <PlainAdd product={product} soldOut={soldOut} />
  }

  return <WithOptions product={product} optionSet={optionSet} currency={currency} />
}

const BUTTON =
  'mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-[var(--sf-radius)] border border-[var(--sf-primary)] text-sm font-semibold text-[var(--sf-primary)] transition-colors hover:bg-[var(--sf-primary)] hover:text-white disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-[var(--sf-primary)]'

function PlainAdd({
  product,
  soldOut,
}: {
  product: React.ComponentProps<typeof CardAdd>['product']
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
      className={BUTTON}
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

function WithOptions({
  product,
  optionSet,
  currency,
}: {
  product: React.ComponentProps<typeof CardAdd>['product']
  optionSet: ProductOptionSet
  currency: string
}) {
  const { add, setOpen } = useCart()
  const [added, setAdded] = useState(false)
  const { picked, pick, selected, available } = useVariantChoice(optionSet.options, optionSet.variants)

  const allOut = optionSet.variants.every((v) => v.stock <= 0)
  const ready = Boolean(selected && selected.stock > 0)

  return (
    /*
      الغلاف بيمنع الضغطات من الوصول لرابط البطاقة.

      من غيره، أي ضغطة على شريحة مقاس كانت بتفتح صفحة المنتج — يعني
      الميزة كلها بتشتغل عكس الغرض منها.
    */
    <div
      className="mt-2 flex flex-col gap-2"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
      }}
    >
      <OptionChips options={optionSet.options} picked={picked} pick={pick} available={available} />

      {/* السعر بيتحدّث مع الاختيار — المقاسات ساعات بأسعار مختلفة */}
      {selected && selected.price !== product.price && (
        <span className="tabular text-sm font-bold text-[var(--sf-primary)]">
          {formatMoney(selected.price, currency)}
        </span>
      )}

      <button
        type="button"
        disabled={!ready}
        onClick={() => {
          if (!selected) return
          add(
            {
              productId: product.productId,
              variantId: selected.id,
              // اسم المتغيّر بيتحط في السلة عشان العميل يفتكر اختار إيه
              name: `${product.name} — ${selected.title}`,
              slug: product.slug,
              image: selected.image ?? product.image,
              price: selected.price,
              maxStock: selected.stock,
            },
            1,
          )
          setAdded(true)
          setOpen(true)
          setTimeout(() => setAdded(false), 1500)
        }}
        className={`${BUTTON} mt-0`}
      >
        {added ? (
          <>
            <Check className="h-4 w-4" aria-hidden="true" />
            اتضاف
          </>
        ) : allOut ? (
          'نفدت الكمية'
        ) : ready ? (
          <>
            <Plus className="h-4 w-4" aria-hidden="true" />
            أضف للسلة
          </>
        ) : (
          'اختار الخيارات'
        )}
      </button>
    </div>
  )
}
