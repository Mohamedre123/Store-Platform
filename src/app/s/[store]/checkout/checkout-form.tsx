'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Banknote, CheckCircle2, Loader2, Lock, Tag, Truck } from 'lucide-react'
import { useCart } from '@/components/storefront/cart'
import { CartLineOptions } from '@/components/storefront/cart-line-options'
import { useStoreHref } from '@/components/storefront/store-link'
import {
  applyCouponAction,
  captureIncompleteOrder,
  placeOrderAction,
  requestOrderOtpAction,
  verifyOrderOtpAction,
} from './actions'
import { formatMoney, isValidEmail, isValidPhone } from '@/lib/utils'
import type { Region } from '@/lib/regions'

type FieldMode = 'required' | 'optional' | 'hidden'

export type CheckoutConfig = {
  fieldName: FieldMode
  fieldPhone: FieldMode
  fieldEmail: FieldMode
  fieldCity: FieldMode
  fieldArea: FieldMode
  fieldStreet: FieldMode
  fieldBuilding: FieldMode
  fieldNotes: FieldMode
  addressMode: 'structured' | 'simple' | 'hidden'
  showCouponField: boolean
  otpEnabled: boolean
  minOrderEnabled: boolean
  minOrderAmount: number
  captureIncomplete: boolean
}

export type PaymentOption = {
  gateway: string
  displayName: string | null
  instructions: string | null
  /** اسم الشركة زي ما هو — بيطمّن العميل إنه بيدفع لجهة معروفة */
  brand: string | null
  color: string | null
  /** بوابة أونلاين (هيتحوّل لصفحة دفع) ولا تحصيل بره النظام؟ */
  online: boolean
}

export function CheckoutForm({
  storeIdentifier,
  currency,
  country,
  regions,
  config,
  payments,
  shippingByCity,
  defaultShipping,
  freeOver,
  carrierName,
  account,
}: {
  storeIdentifier: string
  currency: string
  country: string
  regions: Region[]
  config: CheckoutConfig
  payments: PaymentOption[]
  shippingByCity: Record<string, number>
  defaultShipping: number
  freeOver: number | null
  /** اسم شركة الشحن لما سعرها هو اللي بيحكم — بيطمّن العميل مين هيوصّله */
  carrierName?: string | null
  /**
   * بيانات الحساب اللي داخل.
   *
   * العميل سجّل دخوله قبل الشيك أوت أصلًا، فبياناته معانا. إعادة
   * كتابتها كل مرة خطوة زيادة بتضيّع طلبات — والرقم منها هو اللي
   * بيخلّي السلة المتروكة تتحفظ من أول ثانية.
   */
  account: { name: string | null; phone: string | null; email: string | null }
}) {
  const { items, subtotal, clear, pendingOptions, needsOptions } = useCart()
  const router = useRouter()
  const href = useStoreHref()
  const [pending, startSubmit] = useTransition()

  const [name, setName] = useState(account.name ?? '')
  const [phone, setPhone] = useState(account.phone ?? '')
  const [email, setEmail] = useState(account.email ?? '')
  const accountPhone = account.phone ?? ''
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [street, setStreet] = useState('')
  const [building, setBuilding] = useState('')
  const [notes, setNotes] = useState('')

  /**
   * الملاحظة اللي كتبها العميل في درج السلة بتتنقل هنا.
   *
   * من غير كده يكتب «اتصل قبل التوصيل» في السلة وتضيع — ويفتكر إننا
   * شايفينها. بنملاها مرة واحدة بس عشان ما نلغيش تعديله هنا.
   */
  useEffect(() => {
    try {
      const saved = localStorage.getItem('zw_cart_note')
      if (saved) setNotes((n) => n || saved)
    } catch {}
  }, [])
  const [gateway, setGateway] = useState(payments[0]?.gateway ?? 'cod')
  const selectedOnline = payments.find((p) => p.gateway === gateway)?.online ?? false
  const [error, setError] = useState<string | null>(null)

  // الكوبون
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState<{ code: string; discount: number; freeShipping: boolean } | null>(null)
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [applyingCoupon, startApplyCoupon] = useTransition()

  // رمز التحقق
  const [otpSent, setOtpSent] = useState(false)
  const [otpTarget, setOtpTarget] = useState('')
  const [otpCode, setOtpCode] = useState('')
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpMsg, setOtpMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [otpPending, startOtp] = useTransition()

  const draftToken = useRef<string | undefined>(undefined)
  const captured = useRef(false)

  /** لمس خانة الدفع = وصل لآخر خطوة، حتى لو ما أكّدش */
  const [touchedPayment, setTouchedPayment] = useState(false)
  /** عدّل بياناته بإيده — مش الاسم اللي جه جاهز من حسابه */
  const [touchedContact, setTouchedContact] = useState(false)

  const draftKey = `zw_draft_${storeIdentifier}`

  /*
    استرجاع رمز المسوّدة قبل أي التقاط.

    لازم يتقرا في `useLayoutEffect`-زي التوقيت ده (تأثير بلا تبعيات
    بيجري قبل تأثير الالتقاط اللي مؤجّل ١٢٠٠ مللي)، وإلا الالتقاط
    الأول بيتم برمز جديد وبيتعمل سجل مكرّر.
  */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey)
      if (saved) draftToken.current = saved
    } catch {}
  }, [draftKey])

  function requestOtp() {
    setOtpMsg(null)
    startOtp(async () => {
      const res = await requestOrderOtpAction({ storeIdentifier, phone, email: email || undefined })
      if (res.ok) {
        setOtpSent(true)
        setOtpTarget(res.target)
        setOtpMsg({ ok: true, text: `بعتنا الرمز على ${res.target}` })
      } else {
        setOtpMsg({ ok: false, text: res.error })
      }
    })
  }

  function verifyOtp() {
    setOtpMsg(null)
    startOtp(async () => {
      const res = await verifyOrderOtpAction({ storeIdentifier, phone, code: otpCode })
      if (res.ok) {
        setOtpVerified(true)
        setOtpMsg({ ok: true, text: 'اتأكّد رقمك' })
      } else {
        setOtpMsg({ ok: false, text: res.error })
      }
    })
  }

  const baseShipping = freeOver !== null && subtotal >= freeOver ? 0 : (shippingByCity[city] ?? defaultShipping)
  const shipping = coupon?.freeShipping ? 0 : baseShipping
  const discount = coupon?.discount ?? 0
  const total = Math.max(0, subtotal - discount) + shipping
  const remainingForFree = freeOver !== null && subtotal < freeOver ? freeOver - subtotal : null

  function applyCoupon() {
    const code = couponInput.trim()
    if (!code) return
    setCouponMsg(null)
    startApplyCoupon(async () => {
      const res = await applyCouponAction({
        storeIdentifier,
        code,
        phone: isValidPhone(phone) ? phone : undefined,
        lines: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variantId: i.variantId })),
      })
      if (res.ok) {
        setCoupon({ code: res.code, discount: res.discount, freeShipping: res.freeShipping })
        setCouponMsg({ ok: true, text: res.freeShipping ? 'شحن مجاني اتطبّق' : 'الكود اتطبّق' })
      } else {
        setCoupon(null)
        setCouponMsg({ ok: false, text: res.error })
      }
    })
  }

  function removeCoupon() {
    setCoupon(null)
    setCouponInput('')
    setCouponMsg(null)
  }

  /**
   * المرحلة اللي العميل وصلها.
   *
   * التاجر بيشوفها على السلة المتروكة وبيبني عليها الرسالة اللي
   * يبعتها. «حطّ في السلة وخرج» و«ملا عنوانه ووقف عند الدفع»
   * الاتنين سلة متروكة — بس المسافة من الشرا مختلفة، والكلام اللي
   * يرجّع كل واحد فيهم مختلف.
   *
   * بنقيسها من **فعل العميل** لا من الخانة المليانة: الاسم والرقم
   * جايين من حسابه ومتحطّين له، فلو حسبناهم خطوة، كل واحد يفتح
   * الصفحة يبقى «كتب بياناته» وخطوة «حطّ في السلة وبس» ما تحصلش
   * أبدًا — وهي أكتر خطوة بيتساب عندها الطلب.
   */
  const stage: 'cart' | 'contact' | 'address' | 'payment' = touchedPayment
    ? 'payment'
    : street.trim() || area.trim() || city.trim()
      ? 'address'
      : touchedContact
        ? 'contact'
        : 'cart'

  /**
   * التقاط الطلب الناقص.
   *
   * بيشتغل أول ما يبقى معانا رقم نكلّمه عليه، وبعد ما العميل يبطّل
   * كتابة. ده اللي بيخلي التاجر يشوف الطلب حتى لو العميل قفل الصفحة —
   * ومن غيره الطلب بيضيع من غير ما حد يعرف إنه كان موجودًا.
   *
   * ورقم الحساب المسجّل بيسدّ الفجوة الكبيرة: العميل لازم يسجّل
   * دخوله قبل الشيك أوت، فمعانا رقمه من قبل ما يكتب حرف. من غير
   * كده السلة اللي اتسابت قبل ما يملا الخانات ما كانتش بتتحفظ
   * أصلًا — وهي أكتر سلة بتتساب.
   */
  useEffect(() => {
    if (!config.captureIncomplete || items.length === 0) return

    const reachable = isValidPhone(phone) ? phone : accountPhone
    if (!reachable || !isValidPhone(reachable)) return

    const timer = setTimeout(async () => {
      const result = await captureIncompleteOrder({
        storeIdentifier,
        phone: reachable,
        name: name || undefined,
        /* بريد الحساب لو الخانة فاضية — التذكيرة التلقائية بتمشي على البريد */
        email: email || account.email || undefined,
        city: city || undefined,
        lines: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variantId: i.variantId })),
        draftToken: draftToken.current,
        stage,
      })
      if (result) {
        draftToken.current = result.token
        captured.current = true
        /*
          الرمز بيتحفظ عشان الزيارة الجاية تكمّل على نفس السجل.
          من غيره العميل اللي رجع بعد ساعة بيعمل سلة متروكة تانية،
          والتاجر بيلاقي طلبين ناقصين لنفس الشخص ويكلّمه مرتين.
        */
        try {
          localStorage.setItem(draftKey, result.token)
        } catch {}
      }
    }, 1200)

    return () => clearTimeout(timer)
  }, [phone, name, email, city, items, storeIdentifier, config.captureIncomplete, stage, accountPhone, account.email, draftKey])

  const show = (mode: FieldMode) => mode !== 'hidden'
  const req = (mode: FieldMode) => mode === 'required'

  function submit() {
    setError(null)

    /*
      الخيارات قبل أي فحص تاني.

      الخادم بيرفض الطلب ده أصلًا، لكن الرسالة اللي بتيجي منه بتقول
      «حدّده من السلة» — والعميل هنا مش في السلة. الفحص هنا بيوجّهه
      للخيارات اللي قدامه في الملخّص بدل ما يدوّر.
    */
    if (needsOptions) {
      setError('فيه منتج محتاج تحدّد مقاسه أو لونه — حدّده من ملخّص الطلب')
      return
    }

    if (!isValidPhone(phone)) {
      setError('اكتب رقم تليفون صحيح')
      return
    }
    if (!isValidEmail(email)) {
      setError('اكتب بريدًا إلكترونيًا صحيح — الفاتورة هتوصلك عليه')
      return
    }
    if (config.addressMode === 'structured' && req(config.fieldCity) && !city) {
      setError('اختار المحافظة')
      return
    }
    if (config.minOrderEnabled && subtotal < config.minOrderAmount) {
      setError(`الحد الأدنى للطلب ${formatMoney(config.minOrderAmount, currency)}`)
      return
    }

    startSubmit(async () => {
      const result = await placeOrderAction({
        storeIdentifier,
        name: name || undefined,
        phone,
        email: email.trim(),
        country,
        city: city || undefined,
        area: area || undefined,
        street: street || undefined,
        building: building || undefined,
        notes: notes || undefined,
        paymentGateway: gateway,
        couponCode: coupon?.code || undefined,
        /*
          مواعيد الخدمات اللي العميل اختارها في صفحة المنتج.
          متخزّنة محليًا زي السلة بالظبط — لو بعتناها من السلة نفسها
          كان لازم نغيّر شكلها، وأي سلة قديمة في متصفح عميل كانت
          هتبوظ.
        */
        slots: (() => {
          try {
            const raw = localStorage.getItem('zw_bookings')
            if (!raw) return undefined
            const map = JSON.parse(raw) as Record<string, string>
            const ids = new Set(items.map((i) => i.productId))
            const out: Record<string, string> = {}
            for (const [id, at] of Object.entries(map)) if (ids.has(id)) out[id] = at
            return Object.keys(out).length ? out : undefined
          } catch {
            return undefined
          }
        })(),

        lines: items.map((i) => ({ productId: i.productId, quantity: i.quantity, variantId: i.variantId })),
        draftToken: draftToken.current,
      })

      if (!result || !result.ok) {
        setError(result?.error ?? 'حصلت مشكلة. جرّب تاني.')
        return
      }

      clear()
      try {
        localStorage.removeItem('zw_cart_note')
        localStorage.removeItem('zw_bookings')
        /* المسوّدة بقت طلبًا — رمزها لازم يتشال وإلا الزيارة الجاية تكتب فوقه */
        localStorage.removeItem(draftKey)
      } catch {}

      /**
       * التحويل لصفحة البوابة.
       *
       * `location.assign` لا `router.push`: الرابط برّه الموقع،
       * وموجّه Next بيتعامل مع الروابط الداخلية بس — كان هيحاول
       * يجيب صفحة من عندنا بالمسار ده ويقع في ٤٠٤.
       */
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl)
        return
      }

      const orderHref =
        href(`/order/${result.orderNumber}`) + `?t=${encodeURIComponent(result.token)}`

      /*
        البوابة رفضت تفتح جلسة. الطلب اتسجّل خلاص، فبنودّي العميل
        لصفحته ومعاه السبب وزرار «ادفع دلوقتي» — أحسن من رسالة خطأ
        بتخلّيه يفتكر إن الطلب ضاع فيطلب تاني.
      */
      router.push(result.paymentError ? `${orderHref}&pay_error=1` : orderHref)
    })
  }

  const input =
    'h-12 w-full rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 text-base outline-none transition-colors focus:border-[var(--sf-primary)]'

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      {/* النموذج */}
      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4">
          <h2 className="font-bold">بياناتك</h2>

          {show(config.fieldName) && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">الاسم {req(config.fieldName) && <span className="text-red-500">*</span>}</span>
              <input value={name} onChange={(e) => { setName(e.target.value); setTouchedContact(true) }} className={input} placeholder="محمد أحمد" />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              رقم التليفون <span className="text-red-500">*</span>
            </span>
            <input
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setTouchedContact(true) }}
              inputMode="tel"
              dir="ltr"
              className={`${input} text-start`}
              placeholder="01012345678"
            />
            <span className="text-xs opacity-60">هنكلّمك عليه لتأكيد الطلب</span>
          </label>

          {/*
            البريد إجباري دايمًا — مش تبع إعداد التاجر.

            الفاتورة وتأكيد الطلب وتتبّع الشحنة كلها بتتبعت عليه، وتاجر
            قافل الحقل «عشان ما يطوّلش النموذج» بيخسر الوسيلة الوحيدة
            اللي بتوصل لعميل مش راد على تليفونه. والعنوان ده كمان هو
            اللي بيربط حساب العميل لو سجّل برقمه مرة وبميله مرة.
          */}
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              البريد الإلكتروني <span className="text-red-500">*</span>
            </span>
            <input
              value={email}
              onChange={(e) => { setEmail(e.target.value); setTouchedContact(true) }}
              type="email"
              dir="ltr"
              className={`${input} text-start`}
              placeholder="you@example.com"
            />
            <span className="text-xs opacity-60">هنبعتلك عليه الفاتورة وتأكيد الطلب</span>
          </label>
        </section>

        {config.addressMode !== 'hidden' && (
          <section className="flex flex-col gap-4">
            <h2 className="font-bold">عنوان التوصيل</h2>

            {config.addressMode === 'structured' && show(config.fieldCity) && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">
                  المحافظة {req(config.fieldCity) && <span className="text-red-500">*</span>}
                </span>
                <select value={city} onChange={(e) => setCity(e.target.value)} className={input}>
                  <option value="">اختار المحافظة</option>
                  {regions.map((r) => (
                    <option key={r.code} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {show(config.fieldArea) && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">
                  المنطقة {req(config.fieldArea) && <span className="text-red-500">*</span>}
                </span>
                <input value={area} onChange={(e) => setArea(e.target.value)} className={input} placeholder="المعادي" />
              </label>
            )}

            {show(config.fieldStreet) && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">
                  العنوان {req(config.fieldStreet) && <span className="text-red-500">*</span>}
                </span>
                <input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  className={input}
                  placeholder="شارع ٩، عمارة ١٢"
                />
              </label>
            )}

            {show(config.fieldBuilding) && (
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium">المبنى / الشقة</span>
                <input value={building} onChange={(e) => setBuilding(e.target.value)} className={input} />
              </label>
            )}
          </section>
        )}

        <section className="flex flex-col gap-3">
          <h2 className="font-bold">طريقة الدفع</h2>
          {payments.map((p) => (
            <button
              key={p.gateway}
              type="button"
              onClick={() => {
                setGateway(p.gateway)
                setTouchedPayment(true)
              }}
              aria-pressed={gateway === p.gateway}
              className={`flex min-h-16 items-start gap-3 rounded-[var(--sf-radius)] border p-4 text-start transition-colors ${
                gateway === p.gateway
                  ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/6'
                  : 'border-[var(--sf-text)]/15'
              }`}
            >
              {/*
                البوابة بلونها وأول حرفين من اسمها، والتحصيل النقدي
                بأيقونة. العميل بيتعرّف على «باي موب» من اللون قبل ما
                يقرا الاسم — والثقة دي هي اللي بتخلّيه يكمّل.
              */}
              {p.color ? (
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                  style={{ background: p.color }}
                  aria-hidden="true"
                >
                  {(p.brand ?? p.displayName ?? '').slice(0, 2).toUpperCase()}
                </span>
              ) : (
                <Banknote
                  className="mt-1 h-5 w-5 shrink-0 text-[var(--sf-primary)]"
                  aria-hidden="true"
                />
              )}

              <span className="min-w-0 flex-1">
                <span className="block font-medium">
                  {p.displayName ?? (p.gateway === 'cod' ? 'الدفع عند الاستلام' : p.gateway)}
                </span>
                {p.instructions && (
                  <span className="mt-0.5 block text-sm leading-relaxed opacity-65">{p.instructions}</span>
                )}
                {p.online && (
                  <span className="mt-1 inline-flex items-center gap-1 text-xs opacity-60">
                    <Lock className="h-3 w-3" aria-hidden="true" />
                    هتتحوّل لصفحة {p.brand ?? p.displayName} الآمنة
                  </span>
                )}
              </span>

              {gateway === p.gateway && (
                <CheckCircle2
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sf-primary)]"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </section>

        {show(config.fieldNotes) && (
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">ملاحظات على الطلب</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] p-3 text-base outline-none focus:border-[var(--sf-primary)]"
              placeholder="أي تفاصيل تحب نعرفها"
            />
          </label>
        )}
      </div>

      {/* الملخص */}
      {/*
        `min-w-0` هي اللي بتمنع الصفحة من إنها تتزحلق يمين وشمال على الفون.

        عنصر الشبكة عرضه الأدنى الافتراضي `auto`، يعني بيرفض يصغّر عن
        عرض محتواه — وصف كود الخصم (خانة + زرار «تطبيق») محتواه أعرض
        من ٣٧٥ بكسل بشوية. النتيجة إن الصفحة كلها كانت بتتزق عشرين
        بكسل، والترويسة والفوتر معاها.
      */}
      <aside className="min-w-0 lg:sticky lg:top-20 lg:self-start">
        <div className="flex flex-col gap-4 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 bg-[var(--sf-surface)] p-4">
          <h2 className="font-bold">ملخص الطلب</h2>

          <ul className="flex flex-col gap-3">
            {items.map((i) => (
              <li key={`${i.productId}-${i.variantId ?? ''}`} className="flex flex-col gap-2">
                <div className="flex items-center gap-3">
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6">
                    {i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-cover" />}
                    <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sf-primary)] px-1 text-[10px] font-bold text-white tabular-nums">
                      {i.quantity}
                    </span>
                  </span>
                  <span className="min-w-0 flex-1 text-sm leading-snug">{i.name}</span>
                  <span className="tabular shrink-0 text-sm font-medium">
                    {formatMoney(i.price * i.quantity, currency)}
                  </span>
                </div>

                {/*
                  الخيار الناقص بيتحدّد من هنا مباشرة.

                  العميل اللي ضاف من الصفحة الرئيسية بضغطة وصل لآخر
                  خطوة من غير مقاس. رجوعه للسلة عشان يختار معناه إنه
                  يسيب النموذج اللي ملاه — وده مكان بيتساب فيه الطلب
                  فعلًا.
                */}
                {!i.variantId && pendingOptions[i.productId] && (
                  <CartLineOptions
                    productId={i.productId}
                    name={i.name}
                    slug={i.slug}
                    image={i.image}
                    quantity={i.quantity}
                    optionSet={pendingOptions[i.productId]}
                  />
                )}
              </li>
            ))}
          </ul>

          {remainingForFree !== null && (
            <p className="rounded-[var(--sf-radius)] bg-[var(--sf-primary)]/8 px-3 py-2 text-xs text-[var(--sf-primary)]">
              فاضلك {formatMoney(remainingForFree, currency)} والشحن يبقى مجاني
            </p>
          )}

          {config.showCouponField && (
            <div className="border-t border-[var(--sf-text)]/10 pt-3">
              {coupon ? (
                <div className="flex items-center justify-between gap-2 rounded-[var(--sf-radius)] bg-green-50 px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 font-medium text-green-700">
                    <Tag className="h-3.5 w-3.5" aria-hidden="true" />
                    <bdi dir="ltr">{coupon.code}</bdi> اتطبّق
                  </span>
                  <button type="button" onClick={removeCoupon} className="text-xs text-green-700 underline">
                    شيل
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex gap-2">
                    <input
                      value={couponInput}
                      onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), applyCoupon())}
                      placeholder="كود الخصم"
                      dir="ltr"
                      /*
                        `min-w-0` هي اللي بتمنع الخروج من الكادر.

                        عنصر flex عرضه الأدنى الافتراضي `auto`، يعني
                        بيرفض يصغّر عن عرض محتواه — فالخانة كانت
                        بتزقّ زرار «تطبيق» برّه حدود ملخّص الطلب.
                      */
                      className="h-11 min-w-0 flex-1 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 text-start text-sm uppercase outline-none focus:border-[var(--sf-primary)]"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={applyingCoupon || !couponInput.trim()}
                      className="h-11 shrink-0 whitespace-nowrap rounded-[var(--sf-radius)] border border-[var(--sf-primary)] px-4 text-sm font-medium text-[var(--sf-primary)] transition-colors hover:bg-[var(--sf-primary)]/8 disabled:opacity-50"
                    >
                      {applyingCoupon ? '…' : 'تطبيق'}
                    </button>
                  </div>
                  {couponMsg && !couponMsg.ok && (
                    <p className="mt-1.5 text-xs text-red-600">{couponMsg.text}</p>
                  )}
                </>
              )}
            </div>
          )}

          <dl className="flex flex-col gap-2 border-t border-[var(--sf-text)]/10 pt-3 text-sm">
            <div className="flex justify-between">
              <dt className="opacity-65">المنتجات</dt>
              <dd className="tabular">{formatMoney(subtotal, currency)}</dd>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-green-600">
                <dt className="opacity-90">الخصم</dt>
                <dd className="tabular">− {formatMoney(discount, currency)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="flex items-center gap-1.5 opacity-65">
                <Truck className="h-3.5 w-3.5" aria-hidden="true" />
                {/* اسم الشركة لما تكون هي اللي بتوصّل — العميل بيعرف مين هيرنّله */}
                {carrierName ? `الشحن · ${carrierName}` : 'الشحن'}
              </dt>
              <dd className="tabular">
                {shipping === 0 ? <span className="text-green-600">مجاني</span> : formatMoney(shipping, currency)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-[var(--sf-text)]/10 pt-2 text-base font-bold">
              <dt>الإجمالي</dt>
              <dd className="tabular text-[var(--sf-primary)]">{formatMoney(total, currency)}</dd>
            </div>
          </dl>

          {/* رمز التحقق — قبل زرار التأكيد عشان يبان إنه شرط */}
          {config.otpEnabled && !otpVerified && (
            <div className="flex flex-col gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 p-3">
              <span className="text-sm font-medium">تأكيد رقمك</span>
              {!otpSent ? (
                <>
                  <p className="text-xs opacity-65">هنبعتلك رمزًا على بريدك عشان نتأكد من طلبك.</p>
                  <button
                    type="button"
                    onClick={requestOtp}
                    disabled={otpPending || !isValidPhone(phone) || !email}
                    className="min-h-11 rounded-[var(--sf-radius)] border border-[var(--sf-primary)] text-sm font-semibold text-[var(--sf-primary)] transition-colors hover:bg-[var(--sf-primary)]/8 disabled:opacity-50"
                  >
                    {otpPending ? 'بنبعت…' : 'ابعت رمز التحقق'}
                  </button>
                  {!email && <p className="text-xs text-amber-600">اكتب بريدك الإلكتروني فوق الأول.</p>}
                </>
              ) : (
                <div className="flex gap-2">
                  <input
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    inputMode="numeric"
                    dir="ltr"
                    placeholder="- - - - - -"
                    aria-label="رمز التحقق"
                    className="h-11 flex-1 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 text-center text-lg tracking-[0.4em] outline-none focus:border-[var(--sf-primary)]"
                  />
                  <button
                    type="button"
                    onClick={verifyOtp}
                    disabled={otpPending || otpCode.length !== 6}
                    className="shrink-0 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-4 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    تأكيد
                  </button>
                </div>
              )}
              {otpMsg && (
                <p className={`text-xs ${otpMsg.ok ? 'text-green-600' : 'text-red-600'}`}>{otpMsg.text}</p>
              )}
            </div>
          )}

          {config.otpEnabled && otpVerified && (
            <p className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              رقمك اتأكّد
            </p>
          )}

          {error && (
            <p className="rounded-[var(--sf-radius)] bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
              {error}
            </p>
          )}

          <button
            type="button"
            onClick={submit}
            disabled={
              pending || items.length === 0 || needsOptions || (config.otpEnabled && !otpVerified)
            }
            className="flex min-h-13 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-6 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {/*
              الزرار بيقول اللي هيحصل فعلًا.

              «تأكيد الطلب» على بوابة أونلاين بيخلّي العميل يتفاجئ
              بصفحة دفع ويفتكر إن حاجة غلط حصلت — والمفاجأة دي وقت
              الدفع بتضيّع البيعة.
            */}
            {pending
              ? selectedOnline
                ? 'بنجهّز صفحة الدفع…'
                : 'جاري تأكيد الطلب…'
              : selectedOnline
                ? `تأكيد والدفع · ${formatMoney(total, currency)}`
                : 'تأكيد الطلب'}
          </button>

          {needsOptions ? (
            <p className="text-center text-xs font-medium text-[var(--sf-primary)]">
              حدّد خيارات المنتج فوق عشان تقدر تأكّد الطلب
            </p>
          ) : (
            <p className="text-center text-xs opacity-55">
              بتأكيدك للطلب بتوافق على شروط المتجر
            </p>
          )}
        </div>
      </aside>
    </div>
  )
}
