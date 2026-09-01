'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Banknote, CheckCircle2, Loader2, Lock, X, Zap } from 'lucide-react'
import { useCart } from './cart'
import { useStoreHref } from './store-link'
import { OtpDialog } from './otp-dialog'
import { placeOrderAction } from '@/app/s/[store]/checkout/actions'
import { formatCount, formatMoney, isValidEmail, isValidPhone } from '@/lib/utils'
import { shippingFor, type AddressMode, type FieldMode, type PaymentOption, type ShippingRates } from '@/lib/checkout-ui'
import type { Region } from '@/lib/regions'

/**
 * الدفع السريع من صفحة المنتج.
 *
 * ## المشكلة اللي بيحلّها
 * المسار الطبيعي للشرا أربع شاشات: صفحة المنتج ← السلة ← الشيك أوت ←
 * التأكيد. والعميل اللي جه على منتج واحد بعينه — من إعلان أو من رابط
 * حد بعتهوله — بيمشي في الأربعة عشان حاجة واحدة. كل شاشة فيهم مكان
 * بيتساب فيه الطلب.
 *
 * هنا بيدوس «اشتري دلوقتي»، بيملا اللي ناقص، والطلب بيتسجّل من نفس
 * الصفحة. السلة ما بتتلمسش أصلًا: اللي في سلّته يفضل مكانه لو كان
 * بيجمّع حاجات تانية.
 *
 * ## بيتحكم فيه التاجر
 * الإعداد كان موجود في لوحة التحكم من غير أي حاجة ترسمه — التاجر
 * بيشغّله ويقفله وما بيتغيّرش حرف في متجره. دلوقتي بقى ليه وجود:
 * `inline` بيفتح لوحة تحت الزرار، و`drawer` بيفتح درجًا من الجنب،
 * و«عرض المنتجات» بيقرّر يبان ملخّص الطلب ولا لأ.
 *
 * ## من غير تسجيل دخول
 * الضيف بيكمّل من هنا على طول — ده نص الفايدة. شاشة دخول في نُصّ
 * مسار اتعمل عشان يقصّر الطريق بتلغي السبب اللي اتعمل عشانه.
 *
 * واللي الدخول كان بيحميه، **رمز التحقق بيحميه**: الاتنين بيثبتوا إن
 * اللي بيطلب بيملك الرقم أو البريد. عشان كده الرمز إجباري على الضيف
 * هنا مهما كان إعداد التاجر — والخادم بيفرضه بنفس الشرط، فمفيش زرار
 * يعدّي حاجة الخادم رافضها.
 */

export type QuickItem = {
  productId: string
  variantId?: string
  name: string
  slug: string
  image?: string
  price: number
  maxStock?: number
}

export type QuickCheckoutSettings = {
  storeIdentifier: string
  currency: string
  country: string
  style: 'inline' | 'drawer'
  /** ملخّص المنتج جوّه اللوحة — إعداد التاجر */
  showItems: boolean
  regions: Region[]
  payments: PaymentOption[]
  shipping: ShippingRates
  addressMode: AddressMode
  fieldName: FieldMode
  fieldCity: FieldMode
  fieldArea: FieldMode
  fieldStreet: FieldMode
  fieldBuilding: FieldMode
  /** التاجر مشغّل التحقق؟ — الضيف بياخده على أي حال */
  otpEnabled: boolean
  /**
   * فيه أصلًا طريق يوصّل الرمز؟
   *
   * المتجر اللي مالوش واتساب والبريد عنده مش مضبوط ما ينفعش يتطلب
   * رمزًا — الشاشة هتفتح نافذة على رمز عمره ما هييجي، والعميل يقف.
   * الخادم بيسأل نفس السؤال، فالاتنين بيقرّروا نفس الحاجة.
   */
  otpDeliverable: boolean
  minOrderEnabled: boolean
  minOrderAmount: number
  /** بيانات الحساب الداخل — `null` معناها ضيف */
  account: { name: string | null; phone: string | null; email: string | null } | null
}

export function QuickCheckout({
  item,
  quantity,
  soldOut,
  settings,
}: {
  item: QuickItem
  quantity: number
  soldOut: boolean
  settings: QuickCheckoutSettings
}) {
  const [open, setOpen] = useState(false)

  if (soldOut) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] border-2 border-[var(--sf-primary)] px-6 font-semibold text-[var(--sf-primary)] transition-colors hover:bg-[var(--sf-primary)]/8"
      >
        <Zap className="h-5 w-5" aria-hidden="true" />
        اشتري دلوقتي
      </button>

      {open &&
        (settings.style === 'drawer' ? (
          <QuickDrawer onClose={() => setOpen(false)}>
            <QuickForm item={item} quantity={quantity} settings={settings} onClose={() => setOpen(false)} />
          </QuickDrawer>
        ) : (
          <div className="rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 bg-[var(--sf-surface)] p-4">
            <QuickForm item={item} quantity={quantity} settings={settings} onClose={() => setOpen(false)} />
          </div>
        ))}
    </>
  )
}

/**
 * الدرج الجانبي.
 *
 * بيرسم **جوّه شجرة المتجر** لا في جسم الصفحة: ألوان المتجر متغيّرات
 * CSS متحطّة على حاوية المتجر وبتتوارث لجوّه، واللي بيتنقل بـportal
 * بيخرج من نطاقها ويرسم بألوان فاضية. درج السلة وعجلة الحظ ماشيين
 * بنفس القاعدة من الأول.
 */
function QuickDrawer({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    /* قفل تمرير الصفحة اللي ورا — وإلا العميل يمرّر الاتنين مع بعض */
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="الدفع السريع"
        dir="rtl"
        className="absolute inset-y-0 end-0 flex w-full max-w-md flex-col overflow-y-auto bg-[var(--sf-surface,#fff)] p-4 text-[var(--sf-text,#111)] shadow-2xl sm:p-5"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="-me-1 mb-2 self-start rounded-lg p-1 opacity-55 transition-opacity hover:opacity-100"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        {children}
      </div>
    </div>
  )
}

function QuickForm({
  item,
  quantity,
  settings,
  onClose,
}: {
  item: QuickItem
  quantity: number
  settings: QuickCheckoutSettings
  onClose: () => void
}) {
  const router = useRouter()
  const href = useStoreHref()
  const account = settings.account
  const [pending, startSubmit] = useTransition()

  const [name, setName] = useState(account?.name ?? '')
  const [phone, setPhone] = useState(account?.phone ?? '')
  const [email, setEmail] = useState(account?.email ?? '')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [street, setStreet] = useState('')
  const [building, setBuilding] = useState('')
  const [gateway, setGateway] = useState(settings.payments[0]?.gateway ?? 'cod')
  const [error, setError] = useState<string | null>(null)

  const [otpOpen, setOtpOpen] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)

  const show = (mode: FieldMode) => mode !== 'hidden'
  const req = (mode: FieldMode) => mode === 'required'

  const subtotal = item.price * quantity
  const shipping = shippingFor(settings.shipping, city, subtotal)
  const total = subtotal + shipping
  const selectedOnline = settings.payments.find((p) => p.gateway === gateway)?.online ?? false
  const structured = settings.addressMode === 'structured'

  /* نفس شرط الخادم بالحرف — الاختلاف بينهم معناه زرار بيوعد بحاجة مرفوضة */
  const needsOtp = settings.otpDeliverable && (settings.otpEnabled || !account)

  function submit() {
    setError(null)

    if (!isValidPhone(phone)) {
      setError('اكتب رقم تليفون صحيح')
      return
    }
    if (!isValidEmail(email)) {
      setError('اكتب بريدًا إلكترونيًا صحيح — الفاتورة هتوصلك عليه')
      return
    }
    if (structured && req(settings.fieldCity) && !city) {
      setError('اختار المحافظة')
      return
    }
    if (settings.addressMode !== 'hidden' && req(settings.fieldStreet) && !street.trim()) {
      setError('اكتب عنوان التوصيل')
      return
    }
    if (settings.minOrderEnabled && subtotal < settings.minOrderAmount) {
      setError(`الحد الأدنى للطلب ${formatMoney(settings.minOrderAmount, settings.currency)}`)
      return
    }

    /*
      التحقق جوّه التأكيد لا خطوة جنبه — ونفس شرط الخادم بالحرف.

      الضيف بياخده مهما كان إعداد التاجر: هو الوحيد اللي ما عدّاش على
      شاشة دخول، والرمز هو اللي بيثبت إنه بيملك الرقم اللي بيطلب بيه.
    */
    if (needsOtp && !otpVerified) {
      setOtpOpen(true)
      return
    }

    place()
  }

  function place() {
    startSubmit(async () => {
      const result = await placeOrderAction({
        storeIdentifier: settings.storeIdentifier,
        name: name || undefined,
        phone,
        email: email.trim(),
        country: settings.country,
        city: city || undefined,
        area: area || undefined,
        street: street || undefined,
        building: building || undefined,
        paymentGateway: gateway,
        /*
          سطر واحد بس — السلة ما بتدخلش هنا خالص. اللي في سلّته يفضل
          مكانه: هو جه يشتري الحاجة دي دلوقتي، مش يفضّي عربيته.
        */
        lines: [{ productId: item.productId, quantity, variantId: item.variantId }],
        source: 'quick_checkout',
      })

      if (!result || !result.ok) {
        setError(result?.error ?? 'حصلت مشكلة. جرّب تاني.')
        return
      }

      onClose()

      /* رابط البوابة برّه الموقع — موجّه Next بيتعامل مع الداخلي بس */
      if (result.redirectUrl) {
        window.location.assign(result.redirectUrl)
        return
      }

      const orderHref = href(`/order/${result.orderNumber}`) + `?t=${encodeURIComponent(result.token)}`
      router.push(result.paymentError ? `${orderHref}&pay_error=1` : orderHref)
    })
  }

  const input =
    'h-12 w-full min-w-0 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-transparent px-3 text-base outline-none transition-colors focus:border-[var(--sf-primary)]'

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-bold">إتمام الطلب بسرعة</h2>

      {settings.showItems && (
        <div className="flex items-center gap-3 rounded-[var(--sf-radius)] bg-[var(--sf-text)]/5 p-3">
          {/* الكمية جنب الصورة مش فوقها — نفس قاعدة ملخّص الشيك أوت */}
          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/8">
            {item.image && <Image src={item.image} alt="" fill sizes="56px" className="object-cover" />}
          </span>
          <span className="min-w-0 flex-1 text-sm leading-snug">
            {item.name}
            <span className="mt-1 flex items-center gap-1 text-xs opacity-70">
              الكمية
              <bdi className="tabular font-semibold opacity-100">{formatCount(quantity)}</bdi>
            </span>
          </span>
          <span className="tabular shrink-0 text-sm font-medium">
            {formatMoney(subtotal, settings.currency)}
          </span>
        </div>
      )}

      {show(settings.fieldName) && (
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">
            الاسم {req(settings.fieldName) && <span className="text-red-500">*</span>}
          </span>
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
      </label>

      {/* البريد إجباري زي الشيك أوت بالظبط — الفاتورة والتأكيد بيروحوا عليه */}
      <label className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">
          البريد الإلكتروني <span className="text-red-500">*</span>
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

      {settings.addressMode !== 'hidden' && (
        <>
          {structured && show(settings.fieldCity) && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                المحافظة {req(settings.fieldCity) && <span className="text-red-500">*</span>}
              </span>
              <select value={city} onChange={(e) => setCity(e.target.value)} className={input}>
                <option value="">اختار المحافظة</option>
                {settings.regions.map((r) => (
                  <option key={r.code} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {show(settings.fieldArea) && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                المنطقة {req(settings.fieldArea) && <span className="text-red-500">*</span>}
              </span>
              <input value={area} onChange={(e) => setArea(e.target.value)} className={input} placeholder="المعادي" />
            </label>
          )}

          {show(settings.fieldStreet) && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">
                العنوان {req(settings.fieldStreet) && <span className="text-red-500">*</span>}
              </span>
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                className={input}
                placeholder="شارع ٩، عمارة ١٢"
              />
            </label>
          )}

          {show(settings.fieldBuilding) && (
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium">المبنى / الشقة</span>
              <input value={building} onChange={(e) => setBuilding(e.target.value)} className={input} />
            </label>
          )}
        </>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium">طريقة الدفع</span>
        {settings.payments.map((p) => (
          <button
            key={p.gateway}
            type="button"
            onClick={() => setGateway(p.gateway)}
            aria-pressed={gateway === p.gateway}
            className={`flex min-h-14 items-start gap-3 rounded-[var(--sf-radius)] border p-3 text-start transition-colors ${
              gateway === p.gateway
                ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/6'
                : 'border-[var(--sf-text)]/15'
            }`}
          >
            {p.color ? (
              <span
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white"
                style={{ background: p.color }}
                aria-hidden="true"
              >
                {(p.brand ?? p.displayName ?? '').slice(0, 2).toUpperCase()}
              </span>
            ) : (
              <Banknote className="mt-1 h-5 w-5 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
            )}

            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">
                {p.displayName ?? (p.gateway === 'cod' ? 'الدفع عند الاستلام' : p.gateway)}
              </span>
              {p.online && (
                <span className="mt-0.5 inline-flex items-center gap-1 text-xs opacity-60">
                  <Lock className="h-3 w-3" aria-hidden="true" />
                  هتتحوّل لصفحة {p.brand ?? p.displayName} الآمنة
                </span>
              )}
            </span>

            {gateway === p.gateway && (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
            )}
          </button>
        ))}
      </div>

      <dl className="flex flex-col gap-2 border-t border-[var(--sf-text)]/10 pt-3 text-sm">
        <div className="flex justify-between">
          <dt className="opacity-65">المنتجات</dt>
          <dd className="tabular">{formatMoney(subtotal, settings.currency)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="opacity-65">الشحن</dt>
          <dd className="tabular">
            {shipping === 0 ? <span className="text-green-600">مجاني</span> : formatMoney(shipping, settings.currency)}
          </dd>
        </div>
        <div className="flex justify-between border-t border-[var(--sf-text)]/10 pt-2 text-base font-bold">
          <dt>الإجمالي</dt>
          <dd className="tabular text-[var(--sf-primary)]">{formatMoney(total, settings.currency)}</dd>
        </div>
      </dl>

      {error && (
        <p className="rounded-[var(--sf-radius)] bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={pending}
        className="flex min-h-13 w-full items-center justify-center gap-2 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-6 font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending && <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
        {pending
          ? selectedOnline
            ? 'بنجهّز صفحة الدفع…'
            : 'جاري تأكيد الطلب…'
          : selectedOnline
            ? `تأكيد والدفع · ${formatMoney(total, settings.currency)}`
            : `تأكيد الطلب · ${formatMoney(total, settings.currency)}`}
      </button>

      <p className="text-center text-xs opacity-55">بتأكيدك للطلب بتوافق على شروط المتجر</p>

      {otpOpen && (
        <OtpDialog
          storeIdentifier={settings.storeIdentifier}
          phone={phone}
          email={email || undefined}
          onClose={() => setOtpOpen(false)}
          onVerified={() => {
            setOtpVerified(true)
            setOtpOpen(false)
            place()
          }}
        />
      )}
    </div>
  )
}
