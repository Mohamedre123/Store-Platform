'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ImageOff,
  Loader2,
  Minus,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { Alert, Button, Field, Input, Textarea } from '@/components/ui'
import { Toggle } from '@/components/dashboard/controls'
import { toast } from '@/components/dashboard/toast'
import { formatMoney, fromMinorUnits, toMinorUnits, cn } from '@/lib/utils'
import {
  createManualOrderAction,
  quoteManualOrder,
  searchOrderCustomers,
  searchOrderProducts,
  type ManualQuote,
  type OrderCustomer,
  type OrderProduct,
} from './actions'

/**
 * شاشة الطلب اليدوي.
 *
 * ## اللي بتحلّه
 * التاجر المصري بياخد أغلب طلباته في محادثة — واتساب أو انستجرام أو
 * تليفون. من غير الشاشة دي، الطلبات دي بتفضل في كشكول: المخزون
 * بيغلط، والتقارير ناقصة، وسجل العميل بيبقى نُصّه.
 *
 * ## قواعد التصميم هنا
 * - **الرقم أول خانة.** التاجر معاه رقم العميل قبل أي حاجة تانية،
 *   والرقم بيلاقي العميل بعنوانه فيوفّر عليه كتابة الطلب كله.
 * - **الحساب من الخادم.** كل تغيير في الكميات أو المدينة بيسأل
 *   الخادم عن الإجمالي — عشان الرقم اللي التاجر بيقوله للعميل هو
 *   الرقم اللي هيتحفظ.
 * - **المشاكل بتتقال قبل الحفظ.** «الكمية أكبر من المخزون» بتبان
 *   وهو بيكتب لا بعد ما يدوس حفظ.
 */

type Line = {
  key: string
  productId: string
  variantId: string | null
  name: string
  image: string | null
  /** سعر الكتالوج — مرجع نعرف بيه إن التاجر غيّر السعر */
  catalogPrice: number
  price: number
  quantity: number
  stock: number | null
}

export type ManualOrderConfig = {
  currency: string
  allowOversell: boolean
  allowCustomPrice: boolean
  allowDeposit: boolean
  regions: Array<{ code: string; name: string }>
  /** المدن اللي التاجر فعّل الشحن ليها — أسعارها معروفة */
  shippingCities: string[]
  pickupAllowed: boolean
}

const uid = () => Math.random().toString(36).slice(2, 9)

export function ManualOrderForm({ config }: { config: ManualOrderConfig }) {
  const router = useRouter()

  const [customerId, setCustomerId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [street, setStreet] = useState('')
  const [building, setBuilding] = useState('')

  const [lines, setLines] = useState<Line[]>([])
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery')
  const [discountText, setDiscountText] = useState('')
  const [shippingText, setShippingText] = useState('')
  const [depositText, setDepositText] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'paid' | 'transfer'>('cod')
  const [confirmed, setConfirmed] = useState(true)
  const [notes, setNotes] = useState('')
  const [internalNote, setInternalNote] = useState('')

  const [quote, setQuote] = useState<ManualQuote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, startSave] = useTransition()

  const discount = toMinorUnits(discountText || 0)
  const deposit = toMinorUnits(depositText || 0)
  const shippingOverride = shippingText.trim() === '' ? null : toMinorUnits(shippingText)

  /*
    التسعير بيتسأل من الخادم مع كل تغيير مؤثّر، مؤجَّل ٤٠٠ ملّي.

    من غير التأجيل، تغيير الكمية بالزرار بيبعت طلبًا لكل ضغطة —
    والتاجر اللي بيدوس ١٠ مرات بيولّد ١٠ حسابات بترجع بترتيب عشوائي،
    فيشوف رقم كمية قديمة.
  */
  const quoteKey = JSON.stringify({
    lines: lines.map((l) => [l.productId, l.variantId, l.quantity, l.price]),
    city,
    discount,
    shippingOverride,
    fulfillment,
  })

  useEffect(() => {
    if (lines.length === 0) {
      setQuote(null)
      return
    }
    let alive = true
    const t = setTimeout(() => {
      quoteManualOrder({
        lines: lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          price: l.price,
        })),
        country: 'EG',
        city: city || null,
        discount,
        shippingOverride,
        fulfillment,
      }).then((r) => {
        if (!alive) return
        if ('error' in r) setQuote(null)
        else setQuote(r)
      })
    }, 400)

    return () => {
      alive = false
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey])

  function pickCustomer(c: OrderCustomer) {
    setCustomerId(c.id)
    setName(c.name ?? '')
    setPhone(c.phone ?? '')
    setEmail(c.email ?? '')
    if (c.city) setCity(c.city)
    if (c.area) setArea(c.area)
    if (c.street) setStreet(c.street)
  }

  function addLine(p: OrderProduct, variantId: string | null) {
    const variant = variantId ? p.variants.find((v) => v.id === variantId) : null
    const key = `${p.id}:${variantId ?? ''}`

    setLines((prev) => {
      const existing = prev.find((l) => `${l.productId}:${l.variantId ?? ''}` === key)
      if (existing) {
        return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l))
      }
      const price = variant ? variant.price : p.price
      return [
        ...prev,
        {
          key: uid(),
          productId: p.id,
          variantId,
          name: variant ? `${p.name} — ${variant.title}` : p.name,
          image: p.image,
          catalogPrice: price,
          price,
          quantity: 1,
          stock: variant ? variant.stock : p.trackInventory ? p.stock : null,
        },
      ]
    })
  }

  function setQuantity(key: string, quantity: number) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, quantity: Math.max(1, quantity) } : l)),
    )
  }

  function setPrice(key: string, minor: number) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, price: Math.max(0, minor) } : l)))
  }

  const subtotal = useMemo(
    () => lines.reduce((n, l) => n + l.price * l.quantity, 0),
    [lines],
  )

  /* الإجمالي من الخادم لو وصل، ومن الحساب المحلّي لحد ما يوصل */
  const shown = quote ?? {
    subtotal,
    shipping: 0,
    tax: 0,
    discount,
    total: Math.max(0, subtotal - discount),
    issues: [],
  }

  function submit() {
    setError(null)

    if (lines.length === 0) return setError('ضيف منتج واحد على الأقل')
    if (name.trim().length < 2) return setError('اكتب اسم العميل')
    if (phone.trim().length < 6) return setError('اكتب رقم موبايل صحيح')
    if (fulfillment === 'delivery' && !city.trim()) return setError('اختر المحافظة')

    startSave(async () => {
      const result = await createManualOrderAction({
        customerId,
        name,
        phone,
        email: email.trim() || null,
        country: 'EG',
        city: city || null,
        area: area || null,
        street: street || null,
        building: building || null,
        fulfillment,
        lines: lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          quantity: l.quantity,
          price: l.price,
        })),
        discount,
        shippingOverride,
        deposit,
        paymentMethod,
        status: confirmed ? 'confirmed' : 'pending',
        notes: notes.trim() || null,
        internalNote: internalNote.trim() || null,
      })

      if (!result || 'error' in result) {
        setError(result?.error ?? 'حصلت مشكلة')
        return
      }

      toast(`اتسجّل الطلب رقم ${result.orderNumber}`)
      router.push(`/dashboard/orders/${result.orderId}`)
    })
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <div className="flex flex-col gap-6">
        <CustomerCard
          customerId={customerId}
          name={name}
          phone={phone}
          email={email}
          onPick={pickCustomer}
          onClear={() => setCustomerId(null)}
          setName={setName}
          setPhone={setPhone}
          setEmail={setEmail}
        />

        <ProductsCard
          lines={lines}
          currency={config.currency}
          allowCustomPrice={config.allowCustomPrice}
          allowOversell={config.allowOversell}
          onAdd={addLine}
          onQuantity={setQuantity}
          onPrice={setPrice}
          onRemove={(key) => setLines((prev) => prev.filter((l) => l.key !== key))}
        />

        <section className="surface flex flex-col gap-4 p-4 sm:p-5">
          <h2 className="text-sm font-semibold">التوصيل</h2>

          {config.pickupAllowed && (
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  { value: 'delivery', label: 'توصيل للعميل' },
                  { value: 'pickup', label: 'استلام من الفرع' },
                ] as const
              ).map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setFulfillment(o.value)}
                  aria-pressed={fulfillment === o.value}
                  className={cn(
                    'min-h-11 rounded-lg border px-3 text-sm font-medium transition-colors',
                    fulfillment === o.value
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {fulfillment === 'delivery' && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="المحافظة" required>
                <select
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm"
                >
                  <option value="">اختر المحافظة</option>
                  {config.regions.map((r) => (
                    <option key={r.code} value={r.name}>
                      {r.name}
                      {config.shippingCities.includes(r.name) ? '' : ' (بلا سعر شحن)'}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="المنطقة">
                <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="المعادي" />
              </Field>

              <Field label="الشارع والعنوان">
                <Input
                  value={street}
                  onChange={(e) => setStreet(e.target.value)}
                  placeholder="١٢ شارع النصر"
                />
              </Field>

              <Field label="رقم العمارة / الشقة">
                <Input value={building} onChange={(e) => setBuilding(e.target.value)} />
              </Field>
            </div>
          )}
        </section>

        <section className="surface flex flex-col gap-4 p-4 sm:p-5">
          <h2 className="text-sm font-semibold">ملاحظات</h2>
          <Field label="ملاحظة تظهر للعميل على الفاتورة">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
          <Field
            label="ملاحظة داخلية"
            hint="بتفضل عندك في اللوحة — العميل ما بيشوفهاش لا على الفاتورة ولا في أي رسالة."
          >
            <Textarea
              rows={2}
              value={internalNote}
              onChange={(e) => setInternalNote(e.target.value)}
            />
          </Field>
        </section>
      </div>

      {/* ───────── الملخّص ───────── */}
      <aside className="surface flex flex-col gap-4 p-4 sm:p-5 lg:sticky lg:top-4">
        <h2 className="text-sm font-semibold">ملخّص الطلب</h2>

        {shown.issues.length > 0 && (
          <Alert tone="warning">
            <span className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              <span>
                {shown.issues.map((i) => (
                  <span key={i.name} className="block">
                    {i.reason === 'stock'
                      ? `«${i.name}» المخزون أقل من الكمية المطلوبة`
                      : `«${i.name}» مش متاح`}
                  </span>
                ))}
              </span>
            </span>
          </Alert>
        )}

        <dl className="flex flex-col gap-2 text-sm">
          <SummaryRow label="المجموع الفرعي" value={formatMoney(shown.subtotal, config.currency)} />

          <div className="flex items-center justify-between gap-3">
            <dt className="text-[var(--fg-muted)]">خصم</dt>
            <MoneyInput value={discountText} onChange={setDiscountText} currency={config.currency} />
          </div>

          {fulfillment === 'delivery' && (
            <div className="flex items-center justify-between gap-3">
              <dt className="text-[var(--fg-muted)]">الشحن</dt>
              <MoneyInput
                value={shippingText}
                onChange={setShippingText}
                currency={config.currency}
                placeholder={String(fromMinorUnits(shown.shipping))}
              />
            </div>
          )}

          {shown.tax > 0 && (
            <SummaryRow label="ضريبة" value={formatMoney(shown.tax, config.currency)} />
          )}

          <div className="mt-1 flex items-center justify-between border-t border-[var(--border)] pt-3">
            <dt className="font-semibold">الإجمالي</dt>
            <dd className="tabular text-lg font-bold">
              {formatMoney(shown.total, config.currency)}
            </dd>
          </div>
        </dl>

        {config.allowDeposit && (
          <Field
            label="عربون محصَّل"
            hint={
              deposit > 0
                ? `الباقي عند الاستلام: ${formatMoney(Math.max(0, shown.total - deposit), config.currency)}`
                : 'المبلغ اللي العميل دفعه مقدّمًا — الباقي بيتحصّل عند الاستلام.'
            }
          >
            <MoneyInput value={depositText} onChange={setDepositText} currency={config.currency} wide />
          </Field>
        )}

        <Field label="طريقة الدفع">
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { value: 'cod', label: 'عند الاستلام' },
                { value: 'transfer', label: 'تحويل' },
                { value: 'paid', label: 'مدفوع' },
              ] as const
            ).map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => setPaymentMethod(o.value)}
                aria-pressed={paymentMethod === o.value}
                className={cn(
                  'min-h-10 rounded-lg border px-2 text-xs font-medium transition-colors',
                  paymentMethod === o.value
                    ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                    : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </Field>

        <Toggle
          label="أكّد الطلب على طول"
          hint="إنت كلّمت العميل بنفسك، فالطلب بيدخل «مؤكَّد» جاهز للتجهيز. اقفلها لو لسه مستني ردّه."
          checked={confirmed}
          onChange={setConfirmed}
        />

        {error && <Alert tone="danger">{error}</Alert>}

        <Button onClick={submit} loading={saving} size="lg" className="w-full">
          سجّل الطلب
        </Button>
      </aside>
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-[var(--fg-muted)]">{label}</dt>
      <dd className="tabular">{value}</dd>
    </div>
  )
}

/**
 * خانة مبلغ.
 *
 * بتتعامل بالجنيه في الشاشة وبالقرش في القيمة. التاجر بيكتب «٥٠»
 * ويقصد ٥٠ جنيه — تحويلها للقرش شغل الكود لا شغله.
 */
function MoneyInput({
  value,
  onChange,
  currency,
  placeholder = '0',
  wide = false,
}: {
  value: string
  onChange: (v: string) => void
  currency: string
  placeholder?: string
  wide?: boolean
}) {
  return (
    <div className={cn('flex items-center gap-1.5', wide ? 'w-full' : 'w-32')}>
      <Input
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.]/g, ''))}
        className="h-9 text-end tabular"
      />
      <span className="shrink-0 text-xs text-[var(--fg-subtle)]">{currency}</span>
    </div>
  )
}

/* ────────────────────────── العميل ────────────────────────── */

function CustomerCard({
  customerId,
  name,
  phone,
  email,
  onPick,
  onClear,
  setName,
  setPhone,
  setEmail,
}: {
  customerId: string | null
  name: string
  phone: string
  email: string
  onPick: (c: OrderCustomer) => void
  onClear: () => void
  setName: (v: string) => void
  setPhone: (v: string) => void
  setEmail: (v: string) => void
}) {
  const [results, setResults] = useState<OrderCustomer[]>([])
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)

  /* البحث بيمشي مع الرقم نفسه: التاجر بيكتب الرقم، مش بيفتح بحثًا منفصل */
  useEffect(() => {
    if (customerId || phone.trim().length < 3) {
      setResults([])
      return
    }
    let alive = true
    const t = setTimeout(() => {
      searchOrderCustomers(phone).then((rows) => {
        if (!alive) return
        setResults(rows)
        setOpen(rows.length > 0)
      })
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [phone, customerId])

  useEffect(() => {
    function away(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [])

  return (
    <section className="surface flex flex-col gap-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">العميل</h2>
        {customerId && (
          <button
            type="button"
            onClick={onClear}
            className="flex items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--fg)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            فكّ الربط بالعميل
          </button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div ref={boxRef} className="relative">
          <Field
            label="رقم الموبايل"
            required
            hint={customerId ? 'عميل مسجّل — طلبه هيتضاف لتاريخه.' : 'اكتب الرقم وهنلاقيلك العميل لو طلب قبل كده.'}
          >
            <Input
              dir="ltr"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01xxxxxxxxx"
              className="text-start"
            />
          </Field>

          {open && results.length > 0 && (
            <ul className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] shadow-lg">
              {results.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(c)
                      setOpen(false)
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2.5 text-start hover:bg-[var(--surface-2)]"
                  >
                    <UserRound className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{c.name || 'بلا اسم'}</span>
                      <span dir="ltr" className="block truncate text-start text-xs text-[var(--fg-subtle)]">
                        {c.phone}
                      </span>
                    </span>
                    <span className="tabular shrink-0 text-xs text-[var(--fg-subtle)]">
                      {c.ordersCount} طلب
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Field label="الاسم" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم العميل" />
        </Field>

        <Field label="البريد" hint="اختياري — بيتبعتله الفاتورة عليه لو موجود.">
          <Input
            dir="ltr"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="text-start"
          />
        </Field>
      </div>
    </section>
  )
}

/* ────────────────────────── المنتجات ────────────────────────── */

function ProductsCard({
  lines,
  currency,
  allowCustomPrice,
  allowOversell,
  onAdd,
  onQuantity,
  onPrice,
  onRemove,
}: {
  lines: Line[]
  currency: string
  allowCustomPrice: boolean
  allowOversell: boolean
  onAdd: (p: OrderProduct, variantId: string | null) => void
  onQuantity: (key: string, q: number) => void
  onPrice: (key: string, minor: number) => void
  onRemove: (key: string) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<OrderProduct[]>([])
  const [loading, startLoad] = useTransition()
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const t = setTimeout(() => {
      startLoad(async () => {
        setResults(await searchOrderProducts({ query }))
      })
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  return (
    <section className="surface flex flex-col gap-4 p-4 sm:p-5">
      <h2 className="text-sm font-semibold">المنتجات</h2>

      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)] end-3"
          aria-hidden="true"
        />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="دوّر بالاسم أو الكود"
          className="pe-9"
        />
        {loading && (
          <Loader2
            className="absolute top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-[var(--fg-subtle)] start-3"
            aria-hidden="true"
          />
        )}
      </div>

      {results.length > 0 && (
        <ul className="max-h-72 divide-y divide-[var(--border)] overflow-y-auto rounded-lg border border-[var(--border)]">
          {results.map((p) => {
            const soldOut = p.trackInventory && p.stock <= 0 && p.variants.length === 0
            const open = expanded === p.id

            return (
              <li key={p.id} className="bg-[var(--surface)]">
                <button
                  type="button"
                  onClick={() => {
                    if (p.variants.length > 0) setExpanded(open ? null : p.id)
                    else onAdd(p, null)
                  }}
                  disabled={soldOut && !allowOversell}
                  className="flex w-full items-center gap-3 p-2.5 text-start transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
                >
                  <Thumb src={p.image} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{p.name}</span>
                    <span className="flex flex-wrap items-center gap-2 text-xs text-[var(--fg-subtle)]">
                      <span className="tabular">{formatMoney(p.price, currency)}</span>
                      {p.trackInventory && <span className="tabular">مخزون {p.stock}</span>}
                      {p.status !== 'active' && (
                        <span className="rounded bg-[var(--surface-2)] px-1.5">مخفي</span>
                      )}
                      {p.variants.length > 0 && <span>{p.variants.length} مقاس/لون</span>}
                    </span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
                </button>

                {open && (
                  <ul className="border-t border-[var(--border)] bg-[var(--surface-2)]">
                    {p.variants.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => onAdd(p, v.id)}
                          disabled={v.stock <= 0 && !allowOversell}
                          className="flex w-full items-center gap-3 px-3 py-2 text-start text-sm hover:bg-[var(--surface)] disabled:opacity-50"
                        >
                          <span className="min-w-0 flex-1 truncate">{v.title}</span>
                          <span className="tabular shrink-0 text-xs text-[var(--fg-subtle)]">
                            {formatMoney(v.price, currency)} · مخزون {v.stock}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {lines.length === 0 ? (
        <p className="rounded-lg border border-dashed border-[var(--border-strong)] px-4 py-8 text-center text-sm text-[var(--fg-muted)]">
          مفيش منتجات في الطلب لسه — دوّر فوق وضيف.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border)]">
          {lines.map((l) => {
            const over = l.stock !== null && l.quantity > l.stock
            return (
              <li key={l.key} className="flex flex-wrap items-center gap-3 py-3">
                <Thumb src={l.image} />

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{l.name}</span>
                  {over && (
                    <span className="text-xs text-[var(--color-warning)]">
                      المخزون {l.stock} بس
                    </span>
                  )}
                </span>

                <span className="flex items-center gap-1">
                  <IconBtn label="أنقص" onClick={() => onQuantity(l.key, l.quantity - 1)}>
                    <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                  </IconBtn>
                  <input
                    inputMode="numeric"
                    value={l.quantity}
                    onChange={(e) => onQuantity(l.key, Number(e.target.value.replace(/\D/g, '')) || 1)}
                    aria-label={`كمية ${l.name}`}
                    className="tabular h-9 w-12 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] text-center text-sm"
                  />
                  <IconBtn label="زوّد" onClick={() => onQuantity(l.key, l.quantity + 1)}>
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                  </IconBtn>
                </span>

                {allowCustomPrice ? (
                  <span className="flex w-28 items-center gap-1">
                    <Input
                      inputMode="decimal"
                      aria-label={`سعر ${l.name}`}
                      value={String(fromMinorUnits(l.price))}
                      onChange={(e) =>
                        onPrice(l.key, toMinorUnits(e.target.value.replace(/[^\d.]/g, '') || 0))
                      }
                      className={cn(
                        'h-9 text-end tabular',
                        l.price !== l.catalogPrice && 'border-[var(--primary)] text-[var(--primary)]',
                      )}
                    />
                  </span>
                ) : (
                  <span className="tabular w-24 text-end text-sm">
                    {formatMoney(l.price, currency)}
                  </span>
                )}

                <span className="tabular w-24 text-end text-sm font-semibold">
                  {formatMoney(l.price * l.quantity, currency)}
                </span>

                <IconBtn label={`شيل ${l.name}`} onClick={() => onRemove(l.key)} danger>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                </IconBtn>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function Thumb({ src }: { src: string | null }) {
  if (!src) {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--fg-subtle)]">
        <ImageOff className="h-4 w-4" aria-hidden="true" />
      </span>
    )
  }
  return (
    <Image
      src={src}
      alt=""
      width={40}
      height={40}
      className="h-10 w-10 shrink-0 rounded-lg object-cover"
    />
  )
}

function IconBtn({
  label,
  onClick,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--border-strong)] transition-colors',
        danger
          ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)]'
          : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
      )}
    >
      {children}
    </button>
  )
}
