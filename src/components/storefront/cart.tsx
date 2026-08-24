'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { send as trackEvent } from './tracker'
import { cartOptionsAction } from '@/app/s/[store]/cart-options-actions'
import type { ProductOptionSet } from '@/lib/product-options'

/**
 * السلة.
 *
 * محفوظة في المتصفح لا على الخادم: العميل بيتسوّق قبل ما يسجّل، ولو
 * ربطناها بحساب كنا هنفقد سلّته لو قفل الصفحة. وبتُخزَّن بمفتاح
 * لكل متجر عشان متجرين مفتوحين في نفس المتصفح ما يخلطوش سلالهم.
 *
 * السعر مخزَّن مع البند كلقطة، لكن الحساب النهائي بيتم على الخادم
 * وقت الطلب — ما ينفعش نثق في سعر جاي من المتصفح.
 */

export type CartItem = {
  productId: string
  variantId?: string
  name: string
  slug: string
  image?: string
  price: number
  quantity: number
  maxStock?: number
}

type CartContext = {
  items: CartItem[]
  add: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void
  remove: (productId: string, variantId?: string) => void
  setQuantity: (productId: string, quantity: number, variantId?: string) => void
  clear: () => void
  count: number
  subtotal: number
  isOpen: boolean
  setOpen: (open: boolean) => void
  ready: boolean
  /** درج جانبي ولا صفحة سلة كاملة — إعداد التاجر */
  mode: 'drawer' | 'page'
  /**
   * معرّف المتجر زي ما اتفتح بيه.
   *
   * أجزاء السلة محتاجاه عشان تسأل الخادم عن خيارات المنتجات — وهي
   * جوّه الشجرة أصلًا، فتمريره كخاصية لكل واحد فيهم كان هيخلّي كل
   * صفحة بتعرض سلة تفتكر تمرّره.
   */
  storeIdentifier: string
  /**
   * خيارات المنتجات اللي في السلة من غير اختيار.
   *
   * في السياق مش في المكوّن: قايمة البنود محتاجاها عشان تعرض
   * الاختيار، وزر «إتمام الطلب» محتاجها عشان يتقفل لحد ما يختار.
   * لو كل واحد فيهم جابها لوحده، بيبقى نداءان لنفس البيانات
   * وحالتان ممكن يختلفوا.
   */
  pendingOptions: Record<string, ProductOptionSet>
  /** فيه بند لسه محتاج مقاس أو لون؟ */
  needsOptions: boolean
}

const Ctx = createContext<CartContext | null>(null)

const keyFor = (storeSlug: string) => `zawya_cart_${storeSlug}`
const sameLine = (a: CartItem, productId: string, variantId?: string) =>
  a.productId === productId && (a.variantId ?? '') === (variantId ?? '')

export function CartProvider({
  storeSlug,
  storeIdentifier,
  mode = 'drawer',
  track = true,
  children,
}: {
  /** مفتاح تخزين السلة — لازم يفضل ثابت مهما اختلف طريق الوصول */
  storeSlug: string
  /** المعرّف اللي الـAPI بيفهمه (سلَج أو نطاق) — للقياس */
  storeIdentifier: string
  mode?: 'drawer' | 'page'
  /** يتقفل في المعاينة — تجارب التاجر مش سلوك عملاء */
  track?: boolean
  children: ReactNode
}) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setOpen] = useState(false)
  // قبل القراءة من التخزين، ما نعرضش عدد السلة — وإلا يظهر صفر ثم يقفز
  const [ready, setReady] = useState(false)
  const [pendingOptions, setPendingOptions] = useState<Record<string, ProductOptionSet>>({})

  useEffect(() => {
    try {
      const raw = localStorage.getItem(keyFor(storeSlug))
      if (raw) setItems(JSON.parse(raw) as CartItem[])
    } catch {
      // تخزين معطّل أو بيانات تالفة — نبدأ بسلة فاضية
    }
    setReady(true)
  }, [storeSlug])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(keyFor(storeSlug), JSON.stringify(items))
    } catch {
      // التخزين ممتلئ أو مرفوض — السلة تفضل في الذاكرة للجلسة دي
    }
  }, [items, storeSlug, ready])

  /*
    بنسأل عن خيارات البنود اللي مالهاش متغيّر بس.

    المنتج البسيط ما بيرجّعش حاجة، فالسلة بتفضل زي ما هي. والمفتاح
    مبني من المعرّفات مرتّبة عشان نفس السلة ما تعملش نداءً جديدًا مع
    كل تغيير كمية.
  */
  const bareKey = [...new Set(items.filter((i) => !i.variantId).map((i) => i.productId))]
    .sort()
    .join(',')

  useEffect(() => {
    if (!ready) return
    if (!bareKey) {
      setPendingOptions({})
      return
    }

    let alive = true
    cartOptionsAction({ storeIdentifier, productIds: bareKey.split(',') })
      .then((res) => {
        if (alive) setPendingOptions(res)
      })
      .catch(() => {
        /* فشل النداء ما يقفلش السلة — الخادم بيرفض الطلب الناقص برضه */
      })

    return () => {
      alive = false
    }
  }, [bareKey, storeIdentifier, ready])

  const value = useMemo<CartContext>(() => {
    const count = items.reduce((n, i) => n + i.quantity, 0)
    const subtotal = items.reduce((n, i) => n + i.price * i.quantity, 0)

    return {
      items,
      count,
      subtotal,
      isOpen,
      setOpen,
      ready,
      mode,
      storeIdentifier,
      pendingOptions,
      /*
        البند اللي مالوش متغيّر ومنتجه ليه خيارات = ناقص.
        الزر بيتقفل عليه: الخادم بيرفض الطلب ده أصلًا، والأحسن
        إن العميل يعرف قبل ما يملا بياناته كلها.
      */
      needsOptions: items.some((i) => !i.variantId && pendingOptions[i.productId]),

      add(item, quantity = 1) {
        setItems((prev) => {
          const existing = prev.find((p) => sameLine(p, item.productId, item.variantId))
          if (existing) {
            const wanted = existing.quantity + quantity
            const capped = item.maxStock ? Math.min(wanted, item.maxStock) : wanted
            return prev.map((p) =>
              sameLine(p, item.productId, item.variantId) ? { ...p, quantity: capped } : p,
            )
          }
          return [...prev, { ...item, quantity }]
        })
        // القُمع محتاج يعرف كام واحد ضاف فعلًا مقابل كام واحد شاف
        if (track) trackEvent(storeIdentifier, 'add_to_cart', undefined, item.productId)

        // في وضع الصفحة مفيش درج يفتح — الزرار نفسه بيأكّد الإضافة،
        // ونقل العميل لصفحة السلة مع كل إضافة كان هيقطع تصفّحه
        if (mode === 'drawer') setOpen(true)
      },

      remove(productId, variantId) {
        setItems((prev) => prev.filter((p) => !sameLine(p, productId, variantId)))
      },

      setQuantity(productId, quantity, variantId) {
        setItems((prev) =>
          quantity <= 0
            ? prev.filter((p) => !sameLine(p, productId, variantId))
            : prev.map((p) =>
                sameLine(p, productId, variantId)
                  ? { ...p, quantity: p.maxStock ? Math.min(quantity, p.maxStock) : quantity }
                  : p,
              ),
        )
      },

      clear() {
        setItems([])
      },
    }
  }, [items, isOpen, ready, mode, track, storeIdentifier, pendingOptions])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart لازم يكون جوّه CartProvider')
  return ctx
}
