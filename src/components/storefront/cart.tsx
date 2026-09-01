'use client'

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { send as trackEvent } from './tracker'
import { cartOptionsAction } from '@/app/s/[store]/cart-options-actions'
import { captureCartAction } from '@/app/s/[store]/cart-actions'
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
  /**
   * نوع المنتج — الشيك أوت الذكي بيقرا منه.
   *
   * سلة كلها منتجات رقمية مالهاش عنوان توصيل. اختياري عشان السلال
   * المتخزّنة في متصفحات العملاء من قبل التغيير ما تكسرش — الغايب
   * بيتعامل كمنتج مادي، وده السلوك اللي كان شغّال.
   */
  type?: 'physical' | 'digital' | 'service'
}

type CartContext = {
  items: CartItem[]
  /**
   * `silent` بيضيف من غير ما يفتح الدرج.
   *
   * الدرج بيتفتح عشان يأكّد للعميل إن الإضافة تمّت — بس ده صح لما
   * هو اللي ضغط. استرجاع السلة من رابط تذكيرة بيضيف بنودًا هو مش
   * طالبها دلوقتي، والدرج بيقع فوق الشيك أوت اللي جه عشانه.
   */
  add: (item: Omit<CartItem, 'quantity'>, quantity?: number, silent?: boolean) => void
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
/** نفس مفتاح المسوّدة اللي الشيك أوت بيقرا منه — الصف لازم يفضل واحد */
const draftKeyFor = (storeIdentifier: string) => `zw_draft_${storeIdentifier}`
/** بصمة آخر سلة اتسجّلت — بتمنع إعادة الكتابة على كل صفحة */
const sigKeyFor = (storeIdentifier: string) => `zw_cartsig_${storeIdentifier}`
const sameLine = (a: CartItem, productId: string, variantId?: string) =>
  a.productId === productId && (a.variantId ?? '') === (variantId ?? '')

/** الشكل المخزَّن: بنود + صاحبها. الضيف صاحبه `guest` */
type StoredCart = { owner: string; items: CartItem[] }

/**
 * قراءة السلة المخزَّنة وتقرير هل تخصّ الهوية الحالية.
 *
 * ## القاعدة
 * - نفس الصاحب → ترجع زي ما هي
 * - ضيف ← حساب سجّل دخوله → **تنتقل ليه**
 * - حساب ← ضيف (خروج) أو حساب تاني → **تتفضّى**
 *
 * انتقال سلة الضيف مقصود: الشيك أوت بيطلب الدخول، فالعميل اللي حطّ
 * في سلته وراح يكمّل بيتطلب منه يسجّل — ولو فضّيناها ساعتها كان
 * هيرجع للشيك أوت يلاقيه فاضي، وتبقى كل بيعة من عميل جديد ضايعة.
 *
 * والاتجاهين التانيين بيتفضّوا لأن سلة حد ما تظهرش لحد تاني على نفس
 * الجهاز — لا بعد ما يخرج، ولا لما غيره يدخل.
 */
function readCart(storeSlug: string, identity: string): CartItem[] {
  try {
    const raw = localStorage.getItem(keyFor(storeSlug))
    if (!raw) return []

    const parsed: unknown = JSON.parse(raw)

    /* الشكل القديم كان مصفوفة عارية — بنعتبرها بتاعة ضيف */
    const stored: StoredCart = Array.isArray(parsed)
      ? { owner: 'guest', items: parsed as CartItem[] }
      : {
          owner: typeof (parsed as StoredCart)?.owner === 'string' ? (parsed as StoredCart).owner : 'guest',
          items: Array.isArray((parsed as StoredCart)?.items) ? (parsed as StoredCart).items : [],
        }

    if (stored.owner === identity) return stored.items
    if (stored.owner === 'guest') return stored.items
    return []
  } catch {
    // تخزين معطّل أو بيانات تالفة — نبدأ بسلة فاضية
    return []
  }
}

export function CartProvider({
  storeSlug,
  storeIdentifier,
  mode = 'drawer',
  track = true,
  customerId = null,
  children,
}: {
  /** مفتاح تخزين السلة — لازم يفضل ثابت مهما اختلف طريق الوصول */
  storeSlug: string
  /** المعرّف اللي الـAPI بيفهمه (سلَج أو نطاق) — للقياس */
  storeIdentifier: string
  mode?: 'drawer' | 'page'
  /** يتقفل في المعاينة — تجارب التاجر مش سلوك عملاء */
  track?: boolean
  /**
   * العميل المسجَّل دلوقتي — null للزائر.
   *
   * بيحدّد حاجتين: مين صاحب السلة المخزَّنة (فما تنتقلش لحد تاني على
   * نفس الجهاز)، وهل ينفع نسجّلها كسلة متروكة (محتاج رقمه).
   */
  customerId?: string | null
  children: ReactNode
}) {
  const [items, setItems] = useState<CartItem[]>([])
  const [isOpen, setOpen] = useState(false)
  // قبل القراءة من التخزين، ما نعرضش عدد السلة — وإلا يظهر صفر ثم يقفز
  const [ready, setReady] = useState(false)
  const [pendingOptions, setPendingOptions] = useState<Record<string, ProductOptionSet>>({})

  const identity = customerId ?? 'guest'
  /*
    صاحب السلة اللي في الذاكرة دلوقتي.

    في ref لا في state عشان تأثير الحفظ يقرا منه: لو قرا من
    `identity` مباشرةً، أول رندر بعد تغيّر الهوية كان هيكتب بنود
    الحساب القديم بختم الحساب الجديد — سلة حد تتلبّس لحد تاني
    لجزء من الثانية، ولو الصفحة اتقفلت في اللحظة دي بتفضل كده.
  */
  const owner = useRef(identity)

  useEffect(() => {
    owner.current = identity
    setItems(readCart(storeSlug, identity))
    setReady(true)
  }, [storeSlug, identity])

  useEffect(() => {
    if (!ready) return
    try {
      const payload: StoredCart = { owner: owner.current, items }
      localStorage.setItem(keyFor(storeSlug), JSON.stringify(payload))
    } catch {
      // التخزين ممتلئ أو مرفوض — السلة تفضل في الذاكرة للجلسة دي
    }
  }, [items, storeSlug, ready])

  /*
    تسجيل السلة كسلة متروكة عند العميل المسجَّل.

    ## ليه بتأخير
    كل ضغطة «+» بتغيّر السلة. النداء الفوري كان هيبعت أربع مرات
    للخادم وهو بيظبّط الكمية، وكل واحدة بتكتب في قاعدة البيانات.
    التأخير بيخلّي السجل يتكتب مرة واحدة بعد ما يبطّل لعب.

    ## ليه المفتاح من البنود لا من المصفوفة
    `items` مصفوفة جديدة كل رندر، فالاعتماد عليها كان هيعيد
    التشغيل حتى لو محتواها ما اتغيّرش.
  */
  const itemsRef = useRef(items)
  itemsRef.current = items

  const captureKey = customerId
    ? items
        .map((i) => `${i.productId}:${i.variantId ?? ''}:${i.quantity}`)
        .sort()
        .join('|')
    : ''

  useEffect(() => {
    if (!ready || !customerId || !captureKey) return

    /*
      السلة اللي ما اتغيّرتش ما بتتسجّلش تاني.

      من غير البصمة دي، كل تنقّل بين صفحات المتجر كان هيعيد الالتقاط:
      استعلام تسعير وحساب إجماليات وكتابة في الطلبات مع كل صفحة
      يفتحها عميل معاه سلة. والبصمة محفوظة في المتصفح لا في الذاكرة
      عشان إعادة التحميل ما تعدّش على الحارس ده.

      وفايدة تانية: `abandonedAt` بيفضل على وقت آخر تغيير حقيقي في
      السلة، وهو المعنى الصح لـ«ساب سلته من ساعة» — لا وقت آخر صفحة
      عدّى عليها.
    */
    try {
      if (localStorage.getItem(sigKeyFor(storeIdentifier)) === captureKey) return
    } catch {}

    const timer = setTimeout(() => {
      let draft: string | undefined
      try {
        draft = localStorage.getItem(draftKeyFor(storeIdentifier)) ?? undefined
      } catch {}

      captureCartAction({
        storeIdentifier,
        lines: itemsRef.current.map((i) => ({
          productId: i.productId,
          quantity: i.quantity,
          variantId: i.variantId,
        })),
        draftToken: draft,
      })
        .then((res) => {
          /*
            الرمز بيتحفظ عشان الشيك أوت يكمّل على **نفس** الصف.
            من غيره كان بيتعمل طلب ناقص تاني لنفس العميل، والتاجر
            يلاقي سلتين متروكتين لواحد.
          */
          if (res?.token) {
            try {
              localStorage.setItem(draftKeyFor(storeIdentifier), res.token)
              localStorage.setItem(sigKeyFor(storeIdentifier), captureKey)
            } catch {}
          }
        })
        .catch(() => {
          /* فشل التسجيل ما يمسّش تسوّق العميل — الشيك أوت بيلتقطها برضه */
        })
    }, 1500)

    return () => clearTimeout(timer)
  }, [captureKey, customerId, ready, storeIdentifier])

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

      add(item, quantity = 1, silent = false) {
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
        /*
          الاسترجاع مش «إضافة» في القياس.

          العميل ما ضافش حاجة دلوقتي — إحنا رجّعنا سلّته. تسجيله
          كـ`add_to_cart` بيضخّم قُمع الإضافة بأحداث محدّش عملها،
          ونسبة التحويل بتبان أوطى من الحقيقة.
        */
        if (track && !silent) trackEvent(storeIdentifier, 'add_to_cart', undefined, item.productId)

        // في وضع الصفحة مفيش درج يفتح — الزرار نفسه بيأكّد الإضافة،
        // ونقل العميل لصفحة السلة مع كل إضافة كان هيقطع تصفّحه
        if (mode === 'drawer' && !silent) setOpen(true)
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
