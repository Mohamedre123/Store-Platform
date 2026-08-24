'use client'

import Image from 'next/image'
import { SLink as Link } from './store-link'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useCart } from './cart'
import { CartLineOptions } from './cart-line-options'
import { cartOptionsAction } from '@/app/s/[store]/cart-options-actions'
import { formatMoney } from '@/lib/utils'
import type { UpsellProduct } from '@/lib/storefront'
import type { ProductOptionSet } from '@/lib/product-options'

/**
 * أجزاء السلة المشتركة.
 *
 * الدرج وصفحة السلة بيعرضوا نفس الحاجة بالظبط — نفس البنود ونفس
 * الحسابات ونفس المقترحات. لو كل واحد فيهم كتب نسخته، أي تعديل
 * لاحق (سطر ضريبة، تنبيه مخزون) هيتعمل في مكان وينسى التاني،
 * والعميل يشوف رقمين مختلفين للسلة الواحدة.
 */

/** بنود السلة — قابلة للتعديل والحذف في المكانين */
export function CartLines({
  currency,
  onNavigate,
  compact = true,
}: {
  currency: string
  /** الدرج بيقفل نفسه لما العميل يضغط على منتج؛ الصفحة مش محتاجة */
  onNavigate?: () => void
  compact?: boolean
}) {
  const { items, setQuantity, remove, storeIdentifier } = useCart()
  const size = compact ? 'h-20 w-20' : 'h-24 w-24'

  /*
    الخيارات بتتجاب للسطور اللي مالهاش متغيّر بس.

    العميل اللي ضاف منتج ليه مقاسات بضغطة واحدة لازم يقدر يحدّد
    مقاسه من هنا — تحويله لصفحة المنتج معناه إنه يسيب سلته ويبدأ
    من الأول، ودي أكتر لحظة بيسيب فيها الطلب.

    والمنتج البسيط ما بيرجّعش حاجة من الخادم أصلًا، فالسطر بتاعه
    بيفضل زي ما هو.
  */
  const [optionSets, setOptionSets] = useState<Record<string, ProductOptionSet>>({})

  const pending = items.filter((i) => !i.variantId).map((i) => i.productId)
  const key = [...new Set(pending)].sort().join(',')

  useEffect(() => {
    if (!key) return
    let alive = true
    cartOptionsAction({ storeIdentifier, productIds: key.split(',') }).then((res) => {
      if (alive) setOptionSets((prev) => ({ ...prev, ...res }))
    })
    return () => {
      alive = false
    }
  }, [key, storeIdentifier])

  return (
    <ul className="divide-y divide-[var(--sf-text)]/8">
      {items.map((item) => (
        <li key={`${item.productId}-${item.variantId ?? ''}`} className="flex gap-3 p-4">
          <Link
            href={`/products/${item.slug}`}
            onClick={onNavigate}
            className={`relative ${size} shrink-0 overflow-hidden rounded-lg bg-[var(--sf-text)]/6`}
          >
            {item.image && <Image src={item.image} alt="" fill sizes="96px" className="object-cover" />}
          </Link>

          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Link
              href={`/products/${item.slug}`}
              onClick={onNavigate}
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

              {/* الإجمالي الفرعي للسطر — بيبان في الصفحة بس، الدرج ضيّق */}
              {!compact && (
                <span className="tabular text-sm font-semibold">
                  {formatMoney(item.price * item.quantity, currency)}
                </span>
              )}

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

            {!item.variantId && optionSets[item.productId] && (
              <CartLineOptions
                productId={item.productId}
                name={item.name}
                slug={item.slug}
                image={item.image}
                quantity={item.quantity}
                optionSet={optionSets[item.productId]}
              />
            )}
          </div>
        </li>
      ))}
    </ul>
  )
}

/**
 * شريط الشحن المجاني.
 * «فاضلك ٥٠ جنيه» بيرفع قيمة الطلب أكتر من أي خصم — العميل بيزوّد
 * عشان يوصل للحد بدل ما ياخد خصمًا يقلّل هامش التاجر.
 */
export function FreeShippingProgress({
  subtotal,
  freeOver,
  currency,
}: {
  subtotal: number
  freeOver: number
  currency: string
}) {
  if (freeOver <= 0) return null

  if (subtotal >= freeOver) {
    return <p className="text-sm font-medium text-green-600">مبروك! الشحن مجاني على طلبك</p>
  }

  return (
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
  )
}

/**
 * ملاحظة العميل.
 * محفوظة محليًا عشان تعدّي من السلة للشيك أوت، وبتتمسح بعد الطلب.
 */
export function CartNoteField({ active }: { active: boolean }) {
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!active) return
    try {
      setNote(localStorage.getItem('zw_cart_note') ?? '')
    } catch {
      // التخزين مرفوض — الملاحظة تفضل في الذاكرة وهتتبعت من الشيك أوت
    }
  }, [active])

  if (!active) return null

  return (
    <label className="mb-3 flex flex-col gap-1.5">
      <span className="text-xs opacity-70">ملاحظة على الطلب (اختياري)</span>
      <textarea
        value={note}
        onChange={(e) => {
          setNote(e.target.value)
          try {
            localStorage.setItem('zw_cart_note', e.target.value)
          } catch {}
        }}
        rows={2}
        placeholder="مثال: اتصل قبل التوصيل"
        className="rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--sf-primary)]"
      />
    </label>
  )
}

/**
 * مقترحات «أكمل طلبك».
 *
 * بنستبعد اللي في السلة أصلًا — اقتراح حاجة العميل ضايفها بيخلّي
 * القسم كله يبان غبيًا. وبنعرض تلاتة بحد أقصى: القايمة الطويلة
 * بتحوّل خطوة الدفع لصفحة تصفّح تانية.
 */
export function CartUpsell({
  products,
  title,
  currency,
}: {
  products: UpsellProduct[]
  title: string
  currency: string
}) {
  const { items, add } = useCart()
  const inCart = new Set(items.map((i) => i.productId))
  const suggestions = products.filter((p) => !inCart.has(p.id)).slice(0, 3)

  if (suggestions.length === 0) return null

  return (
    <div className="border-t border-[var(--sf-text)]/10 p-4">
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <ul className="flex flex-col gap-2.5">
        {suggestions.map((p) => (
          <li key={p.id} className="flex items-center gap-3">
            <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-[var(--sf-text)]/6">
              {p.image && <Image src={p.image} alt="" fill sizes="48px" className="object-cover" />}
            </div>
            <div className="min-w-0 flex-1">
              <span className="block truncate text-xs font-medium">{p.name}</span>
              <span className="tabular text-xs font-bold text-[var(--sf-primary)]">
                {formatMoney(p.price, currency)}
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                add({
                  productId: p.id,
                  name: p.name,
                  slug: p.slug,
                  image: p.image ?? undefined,
                  price: p.price,
                  maxStock: p.maxStock ?? undefined,
                })
              }
              className="shrink-0 rounded-lg border border-[var(--sf-primary)] px-3 py-1.5 text-xs font-semibold text-[var(--sf-primary)] transition-colors hover:bg-[var(--sf-primary)] hover:text-white"
            >
              أضف
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
