/**
 * الشحن — شاشة أصلية.
 *
 * نفس صفحة اللوحة بترتيبها: الدفع عند الاستلام بمفتاحه، شركات الشحن (ربط بالمفاتيح في
 * `provider-sheet.tsx`)، تسجيل الشحنة تلقائيًا، الإعدادات العامة، سعر كل محافظة، الملء مرة واحدة
 * (تعريفة الشركة المربوطة أو أسعار المناطق)، وطرق الشحن (إضافة/تعديل/حذف بتأكيد).
 */
import { useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { shippingData, type Provider, type ShippingMethod } from './commerce-api'
import { formatMoney, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { toLatin, WALLET_ICON } from './ops-api'
import { ProviderRow, ProviderSheet, providerBody, providerUrl } from './provider-sheet'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type ZoneForm = { enabled: boolean; defaultPrice: string; freeShippingEnabled: boolean; freeOverAmount: string; minDays: string; maxDays: string }
type MethodForm = { id: string | null; name: string; hint: string; minus: boolean; amount: string; minDays: string; maxDays: string; enabled: boolean; sortOrder: number }
type Panel = 'zone' | 'rates' | 'fill' | null
type FillResult = { filled?: number; applied?: Record<string, string> }

const minor = (s: string) => Math.round((Number(toLatin(s)) || 0) * 100)

function daysLabel(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return min === max ? `${formatNumber(min)} يوم` : `${formatNumber(min)}–${formatNumber(max)} يوم`
  if (min !== null) return `من ${formatNumber(min)} يوم`
  if (max !== null) return `لحد ${formatNumber(max)} يوم`
  return ''
}

export function ShippingScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(shippingData, visible, onUnavailable)
  const [panel, setPanel] = useState<Panel>(null)
  const [zone, setZone] = useState<ZoneForm | null>(null)
  const [rates, setRates] = useState<Record<string, string>>({})
  const [zonePrices, setZonePrices] = useState<Record<string, string>>({})
  const [method, setMethod] = useState<MethodForm | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [provider, setProvider] = useState<Provider | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const currency = data?.currency ?? 'EGP'
  const money = (amount: string) => formatMoney(minor(amount), currency)

  const post = async <T,>(key: string, url: string, body: object, done: string | null): Promise<T | null> => {
    if (busy) return null
    haptic('LIGHT')
    setBusy(key)
    setError(null)
    const res = await postAppJson<T>(url, body)
    if (!res.ok) {
      setBusy(null)
      hapticNotify('ERROR')
      if (panel || method) setError(res.error)
      else toast(res.error, { tone: 'danger' })
      return null
    }
    await load()
    setBusy(null)
    hapticNotify('SUCCESS')
    if (done) toast(done, { tone: 'success', duration: 2200 })
    return res.data
  }

  const closePanel = () => {
    setPanel(null)
    setError(null)
  }

  const openPanel = (next: Exclude<Panel, null>) => {
    if (!data) return
    haptic('LIGHT')
    setError(null)
    if (next === 'zone') {
      const z = data.zone
      setZone({ ...z, minDays: String(z.minDays), maxDays: String(z.maxDays) })
    }
    if (next === 'rates') setRates(Object.fromEntries(data.regions.map((r) => [r.name, r.price])))
    if (next === 'fill') setZonePrices({})
    setPanel(next)
  }

  const openMethod = (m?: ShippingMethod) => {
    haptic('LIGHT')
    setError(null)
    setConfirmDelete(false)
    setMethod(
      m
        ? {
            id: m.id,
            name: m.name,
            hint: m.hint,
            minus: m.priceDelta < 0,
            amount: m.priceDelta ? String(Math.abs(m.priceDelta) / 100) : '',
            minDays: m.minDays === null ? '' : String(m.minDays),
            maxDays: m.maxDays === null ? '' : String(m.maxDays),
            enabled: m.enabled,
            sortOrder: m.sortOrder,
          }
        : { id: null, name: '', hint: '', minus: false, amount: '', minDays: '', maxDays: '', enabled: true, sortOrder: data?.methods.length ?? 0 },
    )
  }

  const fill = async (key: string, body: object) => {
    if (!data) return
    const res = await post<FillResult>(key, '/api/app/shipping/fill', body, null)
    if (!res) return
    toast(`اتملت ${formatNumber(res.filled ?? 0)} محافظة — راجعها`, { tone: 'success', duration: 2600 })
    /* الأسعار اتكتبت خلاص — بنفتح المحافظات عشان يراجعها */
    setRates({ ...Object.fromEntries(data.regions.map((r) => [r.name, r.price])), ...(res.applied ?? {}) })
    setPanel('rates')
  }

  const z = data?.zone
  const filledCount = data?.regions.filter((r) => r.price.trim() !== '').length ?? 0
  const deltaMinor = method ? minor(method.amount) * (method.minus ? -1 : 1) : 0
  const preview = Math.max(0, (data?.sampleBase ?? 0) + deltaMinor)

  const toggleRow = (key: string, on: boolean, label: string, hint: string, onClick: () => void, icon?: string) => (
    <div class="card pv-card rise">
      <button type="button" class="switch-row" onClick={onClick}>
        {icon && (
          <span class="pv-icon">
            <Icon svg={icon} />
          </span>
        )}
        <span class="switch-text">
          <b>{label}</b>
          <small>{hint}</small>
        </span>
        <span class={`switch${on ? ' switch--on' : ''}${busy === key ? ' switch--busy' : ''}`}>
          <span />
        </span>
      </button>
    </div>
  )

  return (
    <Screen visible={visible} title="الشحن" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الشحن</h1>
            <p class="page-sub">اربط شركة شحن وهات تعريفتها، أو حدّد أسعارك بنفسك لكل منطقة.</p>
          </div>
        </header>

        {!data || !z ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب إعدادات الشحن</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2].map((i) => (
                <span key={i} class="sk" style="height:84px;border-radius:20px" />
              ))}
            </div>
          )
        ) : (
          <>
            {toggleRow(
              'cod',
              data.codEnabled,
              'الدفع عند الاستلام',
              'العميل بيدفع كاش للمندوب. اقفله بس لو شركة الشحن عندك ما بتحصّلش، أو نسبة الرفض عالية عندك.',
              () => void post('cod', '/api/app/shipping/cod', { enabled: !data.codEnabled }, data.codEnabled ? 'مقفول — مش هيظهر للعميل' : 'مفتوح — هيظهر للعميل في الشيك أوت'),
              WALLET_ICON,
            )}

            <div class="pv-sec rise">
              <h2>شركات الشحن</h2>
              <p>افتح حسابك عند الشركة، هات مفاتيحك، والزقها هنا. أول ما تربط، الطلب بيتسجّل عندهم لوحده وحالته بتتحدّث في متجرك لوحدها.</p>
            </div>
            {data.pricedCarriers.length > 0 && (
              <p class="np-note pv-gap">
                <b>{data.pricedCarriers.join('، ')}</b> مربوطة، فأسعارها هي اللي بتحكم — والتسعير اليدوي تحت اتقفل. لو أوقفت الشركات كلها،
                بيرجع يشتغل زي ما هو من غير ما تفقد أسعارك.
              </p>
            )}
            <div class="card ops-list rise">
              {data.carriers.map((p) => (
                <ProviderRow
                  key={p.slug}
                  p={p}
                  busy={busy === `p-${p.slug}`}
                  onOpen={() => {
                    haptic('LIGHT')
                    setProvider(p)
                  }}
                  onToggle={() => void post(`p-${p.slug}`, providerUrl('shipping'), providerBody(p, !p.enabled), p.enabled ? `${p.name} اتوقفت` : `${p.name} اتفعّلت`)}
                />
              ))}
            </div>

            {data.carrier && (
              <div class="pv-gap-top">
                {toggleRow(
                  'auto',
                  data.autoShip,
                  'سجّل الشحنة تلقائيًا لما الطلب يتأكّد',
                  data.autoShip
                    ? `أول ما تأكّد طلبًا، بنسجّله عند ${data.carrier.name} وناخد رقم البوليصة. لو الشركة رفضت، الطلب بيفضل زي ما هو والسبب بيظهر على كارت الشركة.`
                    : `الطلبات هتفضل مستنيّة، وإنت اللي بتبعتها لـ${data.carrier.name} من صفحة الشحنات. مفيد لو بتطبع بوليصاتك دفعة واحدة.`,
                  () => void post('auto', '/api/app/shipping/auto-ship', { enabled: !data.autoShip }, data.autoShip ? 'اتقفل — هتسجّل بإيدك' : 'التسجيل التلقائي شغّال'),
                )}
              </div>
            )}

            <div class="pv-sec rise">
              <h2>التسعير</h2>
              <p>السعر الافتراضي والشحن المجاني ومدة التوصيل، وسعر خاص لأي محافظة.</p>
            </div>
            <div class="card ops-list rise">
              <div class="bl-row">
                <button type="button" class="bg-open press" onClick={() => openPanel('zone')}>
                  <span class="pv-icon">
                    <Icon svg={icons.truck()} />
                  </span>
                  <span class="bl-main">
                    <b>إعدادات عامة</b>
                    <small class={z.enabled ? undefined : 'pv-err'}>
                      {z.enabled ? 'الشحن مفعّل' : 'الشحن متوقّف'} · الافتراضي {money(z.defaultPrice || '0')} · {daysLabel(z.minDays, z.maxDays)}
                      {z.freeShippingEnabled && z.freeOverAmount ? ` · مجاني فوق ${money(z.freeOverAmount)}` : ''}
                    </small>
                  </span>
                </button>
              </div>
              <div class="bl-row">
                <button type="button" class="bg-open press" onClick={() => openPanel('rates')}>
                  <span class="pv-icon">
                    <Icon svg={icons.globe()} />
                  </span>
                  <span class="bl-main">
                    <b>سعر كل محافظة</b>
                    <small>{filledCount ? `${formatNumber(filledCount)} محافظة بسعر خاص — والباقي بالافتراضي` : 'كل المحافظات بالسعر الافتراضي'}</small>
                  </span>
                </button>
              </div>
              <div class="bl-row">
                <button type="button" class="bg-open press" onClick={() => openPanel('fill')}>
                  <span class="pv-icon">
                    <Icon svg={icons.sparkles()} />
                  </span>
                  <span class="bl-main">
                    <b>املا الأسعار مرة واحدة</b>
                    <small>{data.carrier?.canFetch ? `هات تعريفة ${data.carrier.name}، أو اكتب أسعار المناطق` : 'اكتب سعر كل منطقة، وإحنا نفرده على محافظاتها'}</small>
                  </span>
                </button>
              </div>
            </div>

            <div class="pv-sec rise">
              <h2>طرق الشحن</h2>
              <p>«عادي» و«سريع» و«استلام من الفرع» — كل واحدة بفرق سعرها ومدّتها، والعميل بيختار في الشيك أوت. الفرق بيتضاف على سعر المحافظة.</p>
            </div>
            {data.methods.length === 0 ? (
              <p class="np-note pv-gap">دلوقتي فيه سعر شحن واحد لكل محافظة، والعميل ما بيختارش. ضيف طريقة تانية لو بتقدّم توصيل سريع أو استلام من فرعك.</p>
            ) : (
              <div class="card ops-list rise">
                {data.methods.map((m) => (
                  <div key={m.id} class="bl-row">
                    <button type="button" class="bg-open press" onClick={() => openMethod(m)}>
                      <span class="bl-main">
                        <b>
                          {m.name}
                          {!m.enabled && <span class="cr-off">موقوفة</span>}
                        </b>
                        <small>
                          {m.priceDelta === 0 ? 'بسعر المحافظة' : `${m.priceDelta > 0 ? '+' : '−'}${formatMoney(Math.abs(m.priceDelta), currency)}`}
                          {m.minDays !== null || m.maxDays !== null ? ` · ${daysLabel(m.minDays, m.maxDays)}` : ''}
                          {m.hint ? ` · ${m.hint}` : ''}
                        </small>
                      </span>
                    </button>
                  </div>
                ))}
              </div>
            )}
            <button type="button" class="btn btn--primary btn--lg press rise ops-add pv-gap-top" onClick={() => openMethod()}>
              <Icon svg={icons.plus()} />
              ضيف طريقة شحن
            </button>
          </>
        )}
      </div>

      <Sheet open={panel === 'zone'} title="إعدادات عامة" onClose={closePanel}>
        {zone && (
          <form
            class="np-form ops-form"
            onSubmit={async (e) => {
              e.preventDefault()
              const ok = await post(
                'zone',
                '/api/app/shipping/zone',
                {
                  enabled: zone.enabled,
                  defaultPrice: toLatin(zone.defaultPrice),
                  freeShippingEnabled: zone.freeShippingEnabled,
                  freeOverAmount: toLatin(zone.freeOverAmount),
                  minDays: Number(toLatin(zone.minDays)) || 0,
                  maxDays: Number(toLatin(zone.maxDays)) || 0,
                },
                'إعدادات الشحن اتحفظت',
              )
              if (ok) closePanel()
            }}
          >
            <button
              type="button"
              class="switch-row"
              onClick={() => {
                haptic('LIGHT')
                setZone({ ...zone, enabled: !zone.enabled })
              }}
            >
              <span class="switch-text">
                <b>الشحن مفعّل</b>
                <small>لو أطفيته، العملاء مش هيقدروا يطلبوا توصيل.</small>
              </span>
              <span class={`switch${zone.enabled ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
            <label class="np-label">
              سعر الشحن الافتراضي ({currency})
              <input class="np-input num" inputMode="decimal" dir="ltr" placeholder="50" value={zone.defaultPrice} onInput={(e) => setZone({ ...zone, defaultPrice: (e.currentTarget as HTMLInputElement).value })} />
              <small class="pv-hint">بينطبق على أي محافظة ما حدّدتش لها سعر خاص.</small>
            </label>
            <div class="np-two">
              <label class="np-label">
                أقل مدة توصيل (يوم)
                <input class="np-input num" inputMode="numeric" dir="ltr" value={zone.minDays} onInput={(e) => setZone({ ...zone, minDays: (e.currentTarget as HTMLInputElement).value })} />
              </label>
              <label class="np-label">
                أقصى مدة توصيل (يوم)
                <input class="np-input num" inputMode="numeric" dir="ltr" value={zone.maxDays} onInput={(e) => setZone({ ...zone, maxDays: (e.currentTarget as HTMLInputElement).value })} />
              </label>
            </div>
            <button
              type="button"
              class="switch-row"
              onClick={() => {
                haptic('LIGHT')
                setZone({ ...zone, freeShippingEnabled: !zone.freeShippingEnabled })
              }}
            >
              <span class="switch-text">
                <b>شحن مجاني فوق مبلغ</b>
                <small>من أقوى الحاجات اللي بترفع قيمة الطلب — العميل بيزوّد عشان يوصل للحد.</small>
              </span>
              <span class={`switch${zone.freeShippingEnabled ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
            {zone.freeShippingEnabled && (
              <label class="np-label">
                الشحن مجاني فوق ({currency})
                <input class="np-input num" inputMode="decimal" dir="ltr" placeholder="1000" value={zone.freeOverAmount} onInput={(e) => setZone({ ...zone, freeOverAmount: (e.currentTarget as HTMLInputElement).value })} />
              </label>
            )}
            {error && <p class="np-error">{error}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={closePanel}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={Boolean(busy)}>
                {busy === 'zone' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                احفظ
              </button>
            </div>
          </form>
        )}
      </Sheet>

      <Sheet open={panel === 'rates'} tall title="سعر كل محافظة" onClose={closePanel}>
        {data && (
          <form
            class="np-form ops-form"
            onSubmit={async (e) => {
              e.preventDefault()
              const ok = await post(
                'rates',
                '/api/app/shipping/rates',
                { rates: Object.fromEntries(Object.entries(rates).map(([k, v]) => [k, toLatin(v.trim())])) },
                'أسعار المحافظات اتحفظت — هتظهر للعملاء فورًا',
              )
              if (ok) closePanel()
            }}
          >
            <p class="np-note">سيب الخانة فاضية عشان تاخد السعر الافتراضي ({money(data.zone.defaultPrice || '0')}).</p>
            <button
              type="button"
              class="act press"
              onClick={() => {
                if (!data.zone.defaultPrice) return void toast('حدّد السعر الافتراضي الأول من «إعدادات عامة»', { tone: 'danger' })
                haptic('LIGHT')
                setRates(Object.fromEntries(data.regions.map((r) => [r.name, data.zone.defaultPrice])))
              }}
            >
              طبّق الافتراضي على الكل
            </button>
            <div class="pv-rates">
              {data.regions.map((r) => (
                <label key={r.name} class="pv-rate">
                  <span>{r.name}</span>
                  <input
                    class="np-input num"
                    inputMode="decimal"
                    dir="ltr"
                    placeholder={data.zone.defaultPrice || '—'}
                    aria-label={`سعر الشحن لـ${r.name}`}
                    value={rates[r.name] ?? ''}
                    onInput={(e) => {
                      const v = (e.currentTarget as HTMLInputElement).value
                      setRates((s) => ({ ...s, [r.name]: v }))
                    }}
                  />
                </label>
              ))}
            </div>
            {error && <p class="np-error">{error}</p>}
            <div class="btn-row pv-sticky">
              <button type="button" class="btn btn--ghost press" onClick={closePanel}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={Boolean(busy)}>
                {busy === 'rates' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                احفظ الأسعار
              </button>
            </div>
          </form>
        )}
      </Sheet>

      <Sheet open={panel === 'fill'} tall title="املا الأسعار مرة واحدة" onClose={closePanel}>
        {data && (
          <div class="np-form ops-form">
            <p class="np-note">
              {data.carrier ? `${data.carrier.name} مربوطة. اسحب تعريفتها، أو اكتب أسعار المناطق بنفسك.` : 'اكتب سعر كل منطقة، وإحنا نفرده على محافظاتها.'}
            </p>
            {data.carrier?.canFetch && (
              <button type="button" class="btn btn--primary press" disabled={Boolean(busy)} onClick={() => void fill('fill-carrier', { mode: 'carrier' })}>
                {busy === 'fill-carrier' ? <span class="spinner" /> : <Icon svg={icons.refresh()} />}
                هات أسعار {data.carrier.name}
              </button>
            )}
            <div class="pv-rates">
              {data.zones.map((zn) => (
                <label key={zn.key} class="pv-rate">
                  <span>
                    {zn.label}
                    <small>{zn.hint}</small>
                  </span>
                  <input
                    class="np-input num"
                    inputMode="decimal"
                    dir="ltr"
                    placeholder="—"
                    aria-label={`سعر الشحن لمنطقة ${zn.label}`}
                    value={zonePrices[zn.key] ?? ''}
                    onInput={(e) => {
                      const v = (e.currentTarget as HTMLInputElement).value
                      setZonePrices((s) => ({ ...s, [zn.key]: v }))
                    }}
                  />
                </label>
              ))}
            </div>
            {error && <p class="np-error">{error}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={closePanel}>
                رجوع
              </button>
              <button
                type="button"
                class="btn btn--primary press"
                disabled={Boolean(busy) || Object.values(zonePrices).every((v) => !v.trim())}
                onClick={() => void fill('fill-zones', { mode: 'zones', prices: Object.fromEntries(Object.entries(zonePrices).map(([k, v]) => [k, toLatin(v.trim())])) })}
              >
                {busy === 'fill-zones' ? <span class="spinner" /> : <Icon svg={icons.sparkles()} />}
                افرد على المحافظات
              </button>
            </div>
          </div>
        )}
      </Sheet>

      <Sheet
        open={Boolean(method)}
        tall
        title={method?.id ? 'تعديل طريقة الشحن' : 'طريقة شحن جديدة'}
        onClose={() => {
          setMethod(null)
          setConfirmDelete(false)
        }}
      >
        {method && data && (
          <form
            class="np-form ops-form"
            onSubmit={async (e) => {
              e.preventDefault()
              if (method.name.trim().length < 2) return setError('اكتب اسم الطريقة')
              const res = await post(
                'method',
                '/api/app/shipping/methods/save',
                {
                  id: method.id ?? undefined,
                  name: method.name.trim(),
                  hint: method.hint.trim(),
                  priceDelta: `${method.minus ? '-' : ''}${toLatin(method.amount.trim()) || '0'}`,
                  minDays: toLatin(method.minDays.trim()),
                  maxDays: toLatin(method.maxDays.trim()),
                  enabled: method.enabled,
                  sortOrder: method.sortOrder,
                },
                method.id ? 'الطريقة اتعدّلت' : 'الطريقة اتضافت',
              )
              if (res) setMethod(null)
            }}
          >
            <label class="np-label">
              الاسم
              <input class="np-input" placeholder="توصيل سريع" maxLength={40} value={method.name} onInput={(e) => setMethod({ ...method, name: (e.currentTarget as HTMLInputElement).value })} />
            </label>
            <label class="np-label">
              سطر توضيحي (اختياري)
              <input class="np-input" placeholder="يوصلك خلال ٢٤ ساعة" maxLength={80} value={method.hint} onInput={(e) => setMethod({ ...method, hint: (e.currentTarget as HTMLInputElement).value })} />
              <small class="pv-hint">بيظهر تحت الاسم في الشيك أوت.</small>
            </label>
            <div class="np-label">
              فرق السعر عن سعر المحافظة
              <div class="chips">
                <button
                  type="button"
                  class={`fchip${!method.minus ? ' fchip--on' : ''}`}
                  onClick={() => {
                    haptic('LIGHT')
                    setMethod({ ...method, minus: false })
                  }}
                >
                  أغلى (زي «سريع»)
                </button>
                <button
                  type="button"
                  class={`fchip${method.minus ? ' fchip--on' : ''}`}
                  onClick={() => {
                    haptic('LIGHT')
                    setMethod({ ...method, minus: true })
                  }}
                >
                  أرخص (زي «استلام من الفرع»)
                </button>
              </div>
              <input class="np-input num" inputMode="decimal" dir="ltr" placeholder="0" value={method.amount} onInput={(e) => setMethod({ ...method, amount: (e.currentTarget as HTMLInputElement).value })} />
              <small class="pv-hint">فاضي أو صفر يعني بسعر المحافظة.</small>
            </div>
            <p class="np-note">
              محافظة شحنها {formatMoney(data.sampleBase, currency)} هتبقى بالطريقة دي <b>{formatMoney(preview, currency)}</b>
              {preview === 0 && deltaMinor < 0 && (
                <>
                  <br />
                  الفرق أكبر من سعر المحافظة، فالشحن بيبقى مجاني — مش بالسالب.
                </>
              )}
            </p>
            <div class="np-two">
              <label class="np-label">
                أقل عدد أيام
                <input class="np-input num" inputMode="numeric" dir="ltr" value={method.minDays} onInput={(e) => setMethod({ ...method, minDays: (e.currentTarget as HTMLInputElement).value })} />
              </label>
              <label class="np-label">
                أكتر عدد أيام
                <input class="np-input num" inputMode="numeric" dir="ltr" value={method.maxDays} onInput={(e) => setMethod({ ...method, maxDays: (e.currentTarget as HTMLInputElement).value })} />
              </label>
            </div>
            <small class="pv-hint">سيب الأيام فاضية عشان تاخد مدة المحافظة.</small>
            <button
              type="button"
              class="switch-row"
              onClick={() => {
                haptic('LIGHT')
                setMethod({ ...method, enabled: !method.enabled })
              }}
            >
              <span class="switch-text">
                <b>مفعّلة</b>
                <small>الموقوفة ما بتظهرش للعميل، وبتفضل محفوظة عندك.</small>
              </span>
              <span class={`switch${method.enabled ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
            {error && <p class="np-error">{error}</p>}
            {confirmDelete ? (
              <div class="ex-confirm">
                <p class="sheet-text">هتحذف «{method.name}». الطلبات القديمة ما بتتأثرش — سعر شحنها محفوظ عليها.</p>
                <div class="btn-row">
                  <button type="button" class="btn btn--ghost press" onClick={() => setConfirmDelete(false)}>
                    رجوع
                  </button>
                  <button
                    type="button"
                    class="btn btn--danger press"
                    disabled={Boolean(busy)}
                    onClick={async () => {
                      if (!method.id) return
                      const res = await post('delete', `/api/app/shipping/methods/${encodeURIComponent(method.id)}/delete`, {}, 'الطريقة اتحذفت')
                      if (res) {
                        setMethod(null)
                        setConfirmDelete(false)
                      }
                    }}
                  >
                    {busy === 'delete' ? <span class="spinner" /> : <Icon svg={icons.trash()} />}
                    أيوه، احذفها
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div class="btn-row">
                  <button type="button" class="btn btn--ghost press" onClick={() => setMethod(null)}>
                    رجوع
                  </button>
                  <button type="submit" class="btn btn--primary press" disabled={Boolean(busy)}>
                    {busy === 'method' ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                    {method.id ? 'احفظ' : 'ضيف الطريقة'}
                  </button>
                </div>
                {method.id && (
                  <button type="button" class="btn btn--ghost btn--danger-text press" onClick={() => setConfirmDelete(true)}>
                    <Icon svg={icons.trash()} />
                    احذف الطريقة
                  </button>
                )}
              </>
            )}
          </form>
        )}
      </Sheet>

      <ProviderSheet provider={provider} kind="shipping" currency={currency} onClose={() => setProvider(null)} onSaved={load} />
    </Screen>
  )
}
