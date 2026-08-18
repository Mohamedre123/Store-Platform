'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Banknote, CheckCircle2, Loader2, Tag, Truck } from 'lucide-react'
import { useCart } from '@/components/storefront/cart'
import { useStoreHref } from '@/components/storefront/store-link'
import {
  applyCouponAction,
  captureIncompleteOrder,
  placeOrderAction,
  requestOrderOtpAction,
  verifyOrderOtpAction,
} from './actions'
import { formatMoney, isValidPhone } from '@/lib/utils'
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
}) {
  const { items, subtotal, clear } = useCart()
  const router = useRouter()
  const href = useStoreHref()
  const [pending, startSubmit] = useTransition()

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [street, setStreet] = useState('')
  const [building, setBuilding] = useState('')
  const [notes, setNotes] = useState('')
  const [gateway, setGateway] = useState(payments[0]?.gateway ?? 'cod')
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
        lines: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
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
   * التقاط الطلب الناقص.
   *
   * بيشتغل أول ما الرقم يبقى صالح، وبعد ما العميل يبطّل كتابة.
   * ده اللي بيخلي التاجر يشوف الطلب حتى لو العميل قفل الصفحة —
   * ومن غيره الطلب بيضيع من غير ما حد يعرف إنه كان موجودًا.
   */
  useEffect(() => {
    if (!config.captureIncomplete || items.length === 0) return
    if (!isValidPhone(phone)) return

    const timer = setTimeout(async () => {
      const result = await captureIncompleteOrder({
        storeIdentifier,
        phone,
        name: name || undefined,
        city: city || undefined,
        lines: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        draftToken: draftToken.current,
      })
      if (result) {
        draftToken.current = result.token
        captured.current = true
      }
    }, 1200)

    return () => clearTimeout(timer)
  }, [phone, name, city, items, storeIdentifier, config.captureIncomplete])

  const show = (mode: FieldMode) => mode !== 'hidden'
  const req = (mode: FieldMode) => mode === 'required'

  function submit() {
    setError(null)

    if (!isValidPhone(phone)) {
      setError('اكتب رقم تليفون صحيح')
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
        email: email || undefined,
        country,
        city: city || undefined,
        area: area || undefined,
        street: street || undefined,
        building: building || undefined,
        notes: notes || undefined,
        paymentGateway: gateway,
        couponCode: coupon?.code || undefined,
        lines: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        draftToken: draftToken.current,
      })

      if (!result || !result.ok) {
        setError(result?.error ?? 'حصلت مشكلة. جرّب تاني.')
        return
      }

      clear()
      router.push(href(`/order/${result.orderNumber}`) + `?t=${encodeURIComponent(result.token)}`)
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
              <input value={name} onChange={(e) => setName(e.target.value)} className={input} placeholder="محمد أحمد" />
            </label>
          )}

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">
              رقم التليفون <span className="text-red-500">*</span>
            </span>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              dir="ltr"
              className={`${input} text-start`}
              placeholder="01012345678"
            />
            <span className="text-xs opacity-60">هنكلّمك عليه لتأكيد الطلب</span>
          </label>

          {show(config.fieldEmail) && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                البريد الإلكتروني {req(config.fieldEmail) && <span className="text-red-500">*</span>}
              </span>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                dir="ltr"
                className={`${input} text-start`}
                placeholder="you@example.com"
              />
            </label>
          )}
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
              onClick={() => setGateway(p.gateway)}
              className={`flex items-start gap-3 rounded-[var(--sf-radius)] border p-4 text-start transition-colors ${
                gateway === p.gateway
                  ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/6'
                  : 'border-[var(--sf-text)]/15'
              }`}
            >
              <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
              <span className="flex-1">
                <span className="block font-medium">
                  {p.displayName ?? (p.gateway === 'cod' ? 'الدفع عند الاستلام' : p.gateway)}
                </span>
                {p.instructions && <span className="block text-sm opacity-65">{p.instructions}</span>}
              </span>
              {gateway === p.gateway && (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
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
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="flex flex-col gap-4 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 bg-[var(--sf-surface)] p-4">
          <h2 className="font-bold">ملخص الطلب</h2>

          <ul className="flex flex-col gap-3">
            {items.map((i) => (
              <li key={`${i.productId}-${i.variantId ?? ''}`} className="flex items-center gap-3">
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6">
                  {i.image && <Image src={i.image} alt="" fill sizes="56px" className="object-cover" />}
                  <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--sf-primary)] px-1 text-[10px] font-bold text-white tabular-nums">
                    {i.quantity}
                  </span>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{i.name}</span>
                <span className="tabular shrink-0 text-sm font-medium">
                  {formatMoney(i.price * i.quantity, currency)}
                </span>
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
                      className="h-11 flex-1 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 text-start text-sm uppercase outline-none focus:border-[var(--sf-primary)]"
                    />
                    <button
                      type="button"
                      onClick={applyCoupon}
                      disabled={applyingCoupon || !couponInput.trim()}
                      className="shrink-0 rounded-[var(--sf-radius)] border border-[var(--sf-primary)] px-4 text-sm font-medium text-[var(--sf-primary)] transition-colors hover:bg-[var(--sf-primary)]/8 disabled:opacity-50"
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
                الشحن
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
            disabled={pending || items.length === 0 || (config.otpEnabled && !otpVerified)}
            className="flex min-h-13 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-6 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
            {pending ? 'جاري تأكيد الطلب…' : 'تأكيد الطلب'}
          </button>

          <p className="text-center text-xs opacity-55">
            بتأكيدك للطلب بتوافق على شروط المتجر
          </p>
        </div>
      </aside>
    </div>
  )
}
