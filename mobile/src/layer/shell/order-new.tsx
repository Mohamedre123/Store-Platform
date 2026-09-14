/**
 * طلب جديد يدوي — شاشة أصلية (`/dashboard/orders/new`).
 *
 * نفس `ManualOrderForm` في اللوحة: العميل (الرقم أول خانة وبيلاقي العميل بعنوانه)، المنتجات (بحث بالاسم أو
 * الكود، المخفي والنافد، المقاسات/الألوان، الكمية −/+، السعر المخصص لو مفتوح، تحذير المخزون)، التوصيل أو
 * الاستلام من الفرع (المحافظة «بلا سعر شحن» متعلّمة)، الملاحظات (للعميل وداخلية)، والملخّص: الإجمالي
 * **من الخادم** مع كل تغيير، الخصم، الشحن (يتكتب بدل المحسوب)، الضريبة، العربون والباقي، طريقة الدفع،
 * و«أكّد الطلب على طول». الشريط اللي تحت فيه الإجمالي و«سجّل الطلب».
 */
import { useEffect, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatMoney, formatNumber } from './format'
import { postAppJson } from './http'
import { navigate } from './navigate'
import { toLatin } from './ops-api'
import { clearOrdersCache } from './orders-api'
import { Screen } from './screen'
import { Icon } from './ui'

type Config = {
  currency: string
  allowOversell: boolean
  allowCustomPrice: boolean
  allowDeposit: boolean
  regions: Array<{ code: string; name: string }>
  shippingCities: string[]
  pickupAllowed: boolean
}
type Setup = { enabled: false } | { enabled: true; quota: { blocked: boolean; limit: number | null }; config: Config }
type Variant = { id: string; title: string; price: number; stock: number; isActive: boolean }
type Product = {
  id: string
  name: string
  sku: string | null
  image: string | null
  price: number
  stock: number
  trackInventory: boolean
  status: string
  categoryName: string | null
  variants: Variant[]
}
type Customer = { id: string; name: string | null; phone: string | null; email: string | null; ordersCount: number; city: string | null; area: string | null; street: string | null }
type Quote = { subtotal: number; shipping: number; tax: number; discount: number; total: number; issues: Array<{ name: string; reason: 'missing' | 'inactive' | 'stock' }> }
type Line = {
  key: string
  productId: string
  variantId: string | null
  name: string
  image: string | null
  /** سعر الكتالوج — مرجع نعرف بيه إن التاجر غيّر السعر */
  catalogPrice: number
  price: number
  priceText: string
  quantity: number
  stock: number | null
}

const uid = () => Math.random().toString(36).slice(2, 9)
const minor = (s: string) => Math.round((Number(toLatin(s).replace(/[^\d.]/g, '')) || 0) * 100)
const major = (n: number) => String(n / 100)

async function getJson<T>(url: string): Promise<{ status: number; json: boolean; data: T | null }> {
  try {
    const r = await fetch(url, { credentials: 'same-origin', cache: 'no-store', headers: { accept: 'application/json' } })
    const json = (r.headers.get('content-type') ?? '').includes('json')
    return { status: r.status, json, data: json && r.ok ? ((await r.json()) as T) : null }
  } catch {
    return { status: 0, json: false, data: null }
  }
}

function Thumb({ src }: { src: string | null }) {
  return <span class="inv-thumb">{src ? <img src={src} alt="" loading="lazy" /> : <Icon svg={icons.package()} />}</span>
}

export function NewOrderScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const [setup, setSetup] = useState<Setup | null>(null)
  const [failed, setFailed] = useState(false)

  const [customerId, setCustomerId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [area, setArea] = useState('')
  const [street, setStreet] = useState('')
  const [building, setBuilding] = useState('')
  const [custResults, setCustResults] = useState<Customer[]>([])

  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [lines, setLines] = useState<Line[]>([])

  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('delivery')
  const [discountText, setDiscountText] = useState('')
  const [shippingText, setShippingText] = useState('')
  const [depositText, setDepositText] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'paid' | 'transfer'>('cod')
  const [confirmed, setConfirmed] = useState(true)
  const [notes, setNotes] = useState('')
  const [internalNote, setInternalNote] = useState('')

  const [quote, setQuote] = useState<Quote | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const load = async () => {
    const res = await getJson<Setup>('/api/app/manual-order')
    if (res.status === 404 && !res.json) return onUnavailable()
    if (!res.data) return setFailed(true)
    setFailed(false)
    setSetup(res.data)
  }

  useEffect(() => {
    if (visible) void load()
  }, [visible])

  const enabled = setup?.enabled === true
  const config = setup && setup.enabled ? setup.config : null
  const cur = config?.currency ?? 'EGP'

  /* المنتجات: بحث مؤجَّل ٣٠٠ms — وأول ما الشاشة تفتح بتجيب الأكثر مبيعًا */
  useEffect(() => {
    if (!visible || !enabled) return
    let alive = true
    setSearching(true)
    const t = setTimeout(async () => {
      const res = await getJson<{ products: Product[] }>(`/api/app/manual-order/products?q=${encodeURIComponent(query.trim())}`)
      if (!alive) return
      setSearching(false)
      if (res.data) setProducts(res.data.products)
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [query, visible, enabled])

  /* العميل: البحث بيمشي مع الرقم نفسه */
  useEffect(() => {
    const q = toLatin(phone.trim())
    if (!enabled || customerId || q.length < 3) {
      setCustResults([])
      return
    }
    let alive = true
    const t = setTimeout(async () => {
      const res = await getJson<{ customers: Customer[] }>(`/api/app/manual-order/customers?q=${encodeURIComponent(q)}`)
      if (alive && res.data) setCustResults(res.data.customers)
    }, 300)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [phone, customerId, enabled])

  const discount = minor(discountText)
  const deposit = minor(depositText)
  const shippingOverride = shippingText.trim() === '' ? null : minor(shippingText)
  const payloadLines = lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity, price: l.price }))

  /* الحساب من الخادم مع كل تغيير مؤثّر، مؤجَّل ٤٠٠ms — الرقم اللي التاجر بيقوله للعميل هو اللي هيتحفظ */
  const quoteKey = JSON.stringify({ l: payloadLines, city, discount, shippingOverride, fulfillment })
  useEffect(() => {
    if (lines.length === 0) {
      setQuote(null)
      return
    }
    let alive = true
    const t = setTimeout(async () => {
      const res = await postAppJson<Quote>('/api/app/manual-order/quote', {
        lines: payloadLines,
        country: 'EG',
        city: city || null,
        discount,
        shippingOverride,
        fulfillment,
      })
      if (alive) setQuote(res.ok ? res.data : null)
    }, 400)
    return () => {
      alive = false
      clearTimeout(t)
    }
  }, [quoteKey])

  const pickCustomer = (c: Customer) => {
    haptic('LIGHT')
    setCustomerId(c.id)
    setName(c.name ?? '')
    setPhone(c.phone ?? '')
    setEmail(c.email ?? '')
    if (c.city) setCity(c.city)
    if (c.area) setArea(c.area)
    if (c.street) setStreet(c.street)
    setCustResults([])
  }

  const addLine = (p: Product, variantId: string | null) => {
    haptic('LIGHT')
    const variant = variantId ? p.variants.find((v) => v.id === variantId) : null
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === p.id && l.variantId === variantId)
      if (existing) return prev.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l))
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
          priceText: major(price),
          quantity: 1,
          stock: variant ? variant.stock : p.trackInventory ? p.stock : null,
        },
      ]
    })
    toast('اتضاف للطلب', { duration: 1200 })
  }

  const patchLine = (key: string, patch: (l: Line) => Partial<Line>) => setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch(l) } : l)))

  const reset = () => {
    setCustomerId(null)
    setName('')
    setPhone('')
    setEmail('')
    setCity('')
    setArea('')
    setStreet('')
    setBuilding('')
    setLines([])
    setFulfillment('delivery')
    setDiscountText('')
    setShippingText('')
    setDepositText('')
    setPaymentMethod('cod')
    setConfirmed(true)
    setNotes('')
    setInternalNote('')
    setQuery('')
    setQuote(null)
    setError(null)
  }

  const subtotal = lines.reduce((n, l) => n + l.price * l.quantity, 0)
  /* الإجمالي من الخادم لو وصل، ومن الحساب المحلّي لحد ما يوصل */
  const shown: Quote = quote ?? { subtotal, shipping: 0, tax: 0, discount, total: Math.max(0, subtotal - discount), issues: [] }

  const fail = (msg: string) => {
    hapticNotify('ERROR')
    setError(msg)
    toast(msg, { tone: 'danger' })
  }

  const submit = async () => {
    if (saving) return
    setError(null)
    if (lines.length === 0) return fail('ضيف منتج واحد على الأقل')
    if (name.trim().length < 2) return fail('اكتب اسم العميل')
    if (phone.trim().length < 6) return fail('اكتب رقم موبايل صحيح')
    if (fulfillment === 'delivery' && !city) return fail('اختر المحافظة')

    haptic('LIGHT')
    setSaving(true)
    const res = await postAppJson<{ orderId: string; orderNumber: number }>('/api/app/manual-order/create', {
      customerId,
      name: name.trim(),
      phone: toLatin(phone.trim()),
      email: email.trim() || null,
      country: 'EG',
      city: city || null,
      area: area.trim() || null,
      street: street.trim() || null,
      building: building.trim() || null,
      fulfillment,
      lines: payloadLines,
      discount,
      shippingOverride,
      deposit,
      paymentMethod,
      status: confirmed ? 'confirmed' : 'pending',
      notes: notes.trim() || null,
      internalNote: internalNote.trim() || null,
    })
    setSaving(false)
    if (!res.ok) return fail(res.error)

    hapticNotify('SUCCESS')
    toast(`اتسجّل الطلب رقم ${res.data.orderNumber}`, { tone: 'success', duration: 2600 })
    clearOrdersCache()
    reset()
    navigate(`/dashboard/orders/${encodeURIComponent(res.data.orderId)}`)
  }

  const blocked = setup?.enabled === true && setup.quota.blocked

  return (
    <Screen
      visible={visible}
      kind="detail"
      title="طلب جديد"
      onBack={() => (history.length > 1 ? history.back() : navigate('/dashboard/orders'))}
      overlay={
        config ? (
          <div class="np-save mo-save">
            <span class="mo-total">
              <small>الإجمالي{quote ? '' : ' (تقريبي)'}</small>
              <b>{formatMoney(shown.total, cur)}</b>
            </span>
            <button type="button" class="btn btn--primary btn--lg press" disabled={saving || blocked} onClick={() => void submit()}>
              {saving ? <span class="spinner" /> : <Icon svg={icons.check()} />}
              سجّل الطلب
            </button>
          </div>
        ) : null
      }
    >
      <div class="home-body home-body--fab">
        {!setup ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نفتح الطلب الجديد</b>
              <p>اتأكد من النت وارجع افتحها تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2].map((i) => (
                <span key={i} class="sk" style="height:140px;border-radius:20px" />
              ))}
            </div>
          )
        ) : !setup.enabled ? (
          <div class="empty empty--compact">
            <span class="empty-icon">
              <Icon svg={icons.bag()} />
            </span>
            <b>الطلبات اليدوية مقفولة</b>
            <p>افتحها من إعدادات الطلبات عشان تقدر تسجّل طلبات جاتلك على واتساب أو في المحل.</p>
            <button type="button" class="btn btn--primary press" onClick={() => navigate('/dashboard/settings/orders')}>
              افتح إعدادات الطلبات
            </button>
          </div>
        ) : (
          config && (
            <>
              <p class="page-sub mo-intro">سجّل طلبًا جالك على واتساب أو انستجرام أو في المحل — المخزون والتقارير بتتحدّث زي أي طلب.</p>

              {blocked && (
                <div class="np-note mo-warn">
                  وصلت لحد الباقة المجانية ({formatNumber(setup.quota.limit ?? 0)} طلبات). اشترك عشان تكمّل تسجيل الطلبات.
                  <button type="button" class="act press pst-note-btn" onClick={() => navigate('/dashboard/subscription')}>
                    افتح الاشتراك
                  </button>
                </div>
              )}

              {/* ───── العميل ───── */}
              <section class="card pv-card mo-card">
                <div class="mo-head">
                  <h2 class="sec-title">العميل</h2>
                  {customerId && (
                    <button type="button" class="mo-link" onClick={() => setCustomerId(null)}>
                      فكّ الربط بالعميل
                    </button>
                  )}
                </div>
                <label class="np-label">
                  رقم الموبايل
                  <input class="np-input" dir="ltr" inputMode="tel" placeholder="01xxxxxxxxx" value={phone} onInput={(e) => setPhone((e.currentTarget as HTMLInputElement).value)} />
                  <small class="pv-hint">{customerId ? 'عميل مسجّل — طلبه هيتضاف لتاريخه.' : 'اكتب الرقم وهنلاقيلك العميل لو طلب قبل كده.'}</small>
                </label>
                {custResults.length > 0 && (
                  <div class="mo-results">
                    {custResults.map((c) => (
                      <button key={c.id} type="button" class="mo-result press" onClick={() => pickCustomer(c)}>
                        <span class="tm-avatar">{(c.name ?? '؟').trim().slice(0, 2) || '؟'}</span>
                        <span class="bl-main">
                          <b>{c.name || 'بلا اسم'}</b>
                          <small>
                            <bdi dir="ltr">{c.phone}</bdi>
                            {c.city ? ` · ${c.city}` : ''}
                          </small>
                        </span>
                        <small class="mo-count">{formatNumber(c.ordersCount)} طلب</small>
                      </button>
                    ))}
                  </div>
                )}
                <label class="np-label">
                  الاسم
                  <input class="np-input" placeholder="اسم العميل" value={name} maxLength={80} onInput={(e) => setName((e.currentTarget as HTMLInputElement).value)} />
                </label>
                <label class="np-label">
                  البريد (اختياري)
                  <input class="np-input" dir="ltr" type="email" inputMode="email" value={email} onInput={(e) => setEmail((e.currentTarget as HTMLInputElement).value)} />
                  <small class="pv-hint">بيتبعتله الفاتورة عليه لو موجود.</small>
                </label>
              </section>

              {/* ───── المنتجات ───── */}
              <section class="card pv-card mo-card">
                <h2 class="sec-title">المنتجات</h2>
                <input class="np-input" placeholder="دوّر بالاسم أو الكود" value={query} onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)} />
                {searching && <small class="pst-hint">بندوّر…</small>}
                {products.length > 0 && (
                  <div class="mo-results mo-products">
                    {products.map((p) => {
                      const soldOut = p.trackInventory && p.stock <= 0 && p.variants.length === 0
                      const open = expanded === p.id
                      return (
                        <div key={p.id} class="mo-product">
                          <button
                            type="button"
                            class="mo-result press"
                            disabled={soldOut && !config.allowOversell}
                            onClick={() => {
                              if (p.variants.length > 0) {
                                haptic('LIGHT')
                                setExpanded(open ? null : p.id)
                              } else addLine(p, null)
                            }}
                          >
                            <Thumb src={p.image} />
                            <span class="bl-main">
                              <b>{p.name}</b>
                              <small>
                                {formatMoney(p.price, cur)}
                                {p.trackInventory ? ` · مخزون ${formatNumber(p.stock)}` : ''}
                                {p.status !== 'active' ? ' · مخفي' : ''}
                                {p.variants.length > 0 ? ` · ${formatNumber(p.variants.length)} مقاس/لون` : ''}
                              </small>
                            </span>
                            <Icon svg={icons.plus()} />
                          </button>
                          {open && (
                            <div class="mo-variants">
                              {p.variants.map((v) => (
                                <button key={v.id} type="button" class="mo-variant press" disabled={v.stock <= 0 && !config.allowOversell} onClick={() => addLine(p, v.id)}>
                                  <span>{v.title}</span>
                                  <small>
                                    {formatMoney(v.price, cur)} · مخزون {formatNumber(v.stock)}
                                  </small>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}

                {lines.length === 0 ? (
                  <p class="mo-empty">مفيش منتجات في الطلب لسه — دوّر فوق وضيف.</p>
                ) : (
                  <div class="mo-lines">
                    <b class="mo-lines-title">في الطلب ({formatNumber(lines.length)})</b>
                    {lines.map((l) => {
                      const over = l.stock !== null && l.quantity > l.stock
                      return (
                        <div key={l.key} class="mo-line">
                          <div class="mo-line-top">
                            <Thumb src={l.image} />
                            <span class="bl-main">
                              <b>{l.name}</b>
                              {over && <small class="sc-warn">المخزون {formatNumber(l.stock ?? 0)} بس</small>}
                            </span>
                            <button type="button" class="ops-icon press pst-del" aria-label={`شيل ${l.name}`} onClick={() => (haptic('LIGHT'), setLines((prev) => prev.filter((x) => x.key !== l.key)))}>
                              <Icon svg={icons.trash()} />
                            </button>
                          </div>
                          <div class="mo-line-bottom">
                            <span class="mo-qty">
                              <button type="button" class="mo-step press" aria-label="أنقص" onClick={() => (haptic('LIGHT'), patchLine(l.key, (x) => ({ quantity: Math.max(1, x.quantity - 1) })))}>
                                −
                              </button>
                              <input
                                class="np-input num"
                                inputMode="numeric"
                                aria-label={`كمية ${l.name}`}
                                value={l.quantity}
                                onInput={(e) => {
                                  const q = Number(toLatin((e.currentTarget as HTMLInputElement).value).replace(/\D/g, '')) || 1
                                  patchLine(l.key, () => ({ quantity: Math.min(9999, q) }))
                                }}
                              />
                              <button type="button" class="mo-step press" aria-label="زوّد" onClick={() => (haptic('LIGHT'), patchLine(l.key, (x) => ({ quantity: Math.min(9999, x.quantity + 1) })))}>
                                +
                              </button>
                            </span>
                            {config.allowCustomPrice ? (
                              <input
                                class={`np-input num mo-price${l.price !== l.catalogPrice ? ' mo-price--changed' : ''}`}
                                inputMode="decimal"
                                aria-label={`سعر ${l.name}`}
                                value={l.priceText}
                                onInput={(e) => {
                                  const text = (e.currentTarget as HTMLInputElement).value
                                  patchLine(l.key, () => ({ priceText: text, price: minor(text) }))
                                }}
                              />
                            ) : (
                              <span class="mo-price-text">{formatMoney(l.price, cur)}</span>
                            )}
                            <b class="mo-line-total">{formatMoney(l.price * l.quantity, cur)}</b>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* ───── التوصيل ───── */}
              <section class="card pv-card mo-card">
                <h2 class="sec-title">التوصيل</h2>
                {config.pickupAllowed && (
                  <div class="chips">
                    {(
                      [
                        { value: 'delivery', label: 'توصيل للعميل' },
                        { value: 'pickup', label: 'استلام من الفرع' },
                      ] as const
                    ).map((o) => (
                      <button key={o.value} type="button" class={`fchip${fulfillment === o.value ? ' fchip--on' : ''}`} onClick={() => (haptic('LIGHT'), setFulfillment(o.value))}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
                {fulfillment === 'delivery' && (
                  <>
                    <label class="np-label">
                      المحافظة
                      <select class="np-input" value={city} onChange={(e) => setCity((e.currentTarget as HTMLSelectElement).value)}>
                        <option value="">اختر المحافظة</option>
                        {config.regions.map((r) => (
                          <option key={r.code} value={r.name}>
                            {r.name}
                            {config.shippingCities.includes(r.name) ? '' : ' (بلا سعر شحن)'}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label class="np-label">
                      المنطقة
                      <input class="np-input" placeholder="المعادي" value={area} onInput={(e) => setArea((e.currentTarget as HTMLInputElement).value)} />
                    </label>
                    <div class="np-two">
                      <label class="np-label">
                        الشارع والعنوان
                        <input class="np-input" placeholder="١٢ شارع النصر" value={street} onInput={(e) => setStreet((e.currentTarget as HTMLInputElement).value)} />
                      </label>
                      <label class="np-label">
                        العمارة / الشقة
                        <input class="np-input" value={building} onInput={(e) => setBuilding((e.currentTarget as HTMLInputElement).value)} />
                      </label>
                    </div>
                  </>
                )}
              </section>

              {/* ───── الملاحظات ───── */}
              <section class="card pv-card mo-card">
                <h2 class="sec-title">ملاحظات</h2>
                <label class="np-label">
                  ملاحظة تظهر للعميل على الفاتورة
                  <textarea class="np-input np-textarea" rows={2} maxLength={1000} value={notes} onInput={(e) => setNotes((e.currentTarget as HTMLTextAreaElement).value)} />
                </label>
                <label class="np-label">
                  ملاحظة داخلية
                  <textarea class="np-input np-textarea" rows={2} maxLength={1000} value={internalNote} onInput={(e) => setInternalNote((e.currentTarget as HTMLTextAreaElement).value)} />
                  <small class="pv-hint">بتفضل عندك في اللوحة — العميل ما بيشوفهاش لا على الفاتورة ولا في أي رسالة.</small>
                </label>
              </section>

              {/* ───── الملخّص ───── */}
              <section class="card pv-card mo-card">
                <h2 class="sec-title">ملخّص الطلب</h2>
                {shown.issues.length > 0 && (
                  <div class="np-note mo-warn">
                    {shown.issues.map((i) => (
                      <span key={i.name} class="mo-issue">
                        {i.reason === 'stock' ? `«${i.name}» المخزون أقل من الكمية المطلوبة` : `«${i.name}» مش متاح`}
                      </span>
                    ))}
                  </div>
                )}
                <div class="mo-sum">
                  <span>المجموع الفرعي</span>
                  <b>{formatMoney(shown.subtotal, cur)}</b>
                </div>
                <label class="mo-sum">
                  <span>خصم</span>
                  <input class="np-input num mo-money" inputMode="decimal" placeholder="0" value={discountText} onInput={(e) => setDiscountText((e.currentTarget as HTMLInputElement).value)} />
                </label>
                {fulfillment === 'delivery' && (
                  <label class="mo-sum">
                    <span>الشحن</span>
                    <input class="np-input num mo-money" inputMode="decimal" placeholder={major(shown.shipping)} value={shippingText} onInput={(e) => setShippingText((e.currentTarget as HTMLInputElement).value)} />
                  </label>
                )}
                {shown.tax > 0 && (
                  <div class="mo-sum">
                    <span>ضريبة</span>
                    <b>{formatMoney(shown.tax, cur)}</b>
                  </div>
                )}
                <div class="mo-sum mo-sum--total">
                  <span>الإجمالي</span>
                  <b>{formatMoney(shown.total, cur)}</b>
                </div>
                {fulfillment === 'delivery' && <small class="pv-hint">الشحن محسوب من إعداداتك — اكتب رقم لو اتفقت مع العميل على سعر تاني.</small>}

                {config.allowDeposit && (
                  <label class="np-label">
                    عربون محصَّل
                    <input class="np-input num" inputMode="decimal" placeholder="0" value={depositText} onInput={(e) => setDepositText((e.currentTarget as HTMLInputElement).value)} />
                    <small class="pv-hint">
                      {deposit > 0
                        ? `الباقي عند الاستلام: ${formatMoney(Math.max(0, shown.total - deposit), cur)}`
                        : 'المبلغ اللي العميل دفعه مقدّمًا — الباقي بيتحصّل عند الاستلام.'}
                    </small>
                  </label>
                )}

                <div class="np-label">
                  طريقة الدفع
                  <div class="chips">
                    {(
                      [
                        { value: 'cod', label: 'عند الاستلام' },
                        { value: 'transfer', label: 'تحويل' },
                        { value: 'paid', label: 'مدفوع' },
                      ] as const
                    ).map((o) => (
                      <button key={o.value} type="button" class={`fchip${paymentMethod === o.value ? ' fchip--on' : ''}`} onClick={() => (haptic('LIGHT'), setPaymentMethod(o.value))}>
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button type="button" class="switch-row" onClick={() => (haptic('LIGHT'), setConfirmed(!confirmed))}>
                  <span class="switch-text">
                    <b>أكّد الطلب على طول</b>
                    <small>إنت كلّمت العميل بنفسك، فالطلب بيدخل «مؤكَّد» جاهز للتجهيز. اقفلها لو لسه مستني ردّه.</small>
                  </span>
                  <span class={`switch${confirmed ? ' switch--on' : ''}`}>
                    <span />
                  </span>
                </button>

                {error && <p class="np-error">{error}</p>}
              </section>
            </>
          )
        )}
      </div>
    </Screen>
  )
}
