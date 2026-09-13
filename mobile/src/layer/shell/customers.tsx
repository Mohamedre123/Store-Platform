/**
 * قايمة العملاء — شاشة أصلية.
 *
 * نفس صفحة العملاء في اللوحة: الأرقام الثلاثة، «كل العملاء / المشتركون»،
 * والترتيب بالإنفاق. وزيادة عليها بحث فوري بالاسم أو الرقم أو البريد،
 * لأن التاجر على الموبايل غالبًا بيدوّر على عميل بعينه كلّمه دلوقتي.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import {
  customerPreviews,
  fetchCustomers,
  readCustomersCache,
  type CustomersPayload,
  type ListCustomer,
} from './customers-api'
import { formatDateTime, formatMoney, formatNumber, initials } from './format'
import { navigate } from './navigate'
import { whatsappLink } from './orders-api'
import { Screen } from './screen'
import { Icon } from './ui'

export const TIER_TONES: Record<string, string> = {
  bronze: 'muted',
  silver: 'muted',
  gold: 'warn',
  platinum: 'primary',
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[\s+-]/g, '')

export function CustomersScreen({ visible, url, onUnavailable }: { visible: boolean; url: URL; onUnavailable: () => void }) {
  const urlFilter = url.searchParams.get('filter') === 'subscribers' ? 'subscribers' : 'all'
  const [filter, setFilter] = useState(urlFilter)
  const [store, setStore] = useState<Record<string, { at: number; data: CustomersPayload }>>({})
  const [failed, setFailed] = useState(false)
  const [query, setQuery] = useState('')
  const busy = useRef<string | null>(null)

  useEffect(() => {
    if (visible) setFilter(urlFilter)
  }, [urlFilter, visible])

  const current = useMemo(() => store[filter] ?? readCustomersCache(filter), [store, filter])

  const load = useCallback(
    async (f: string) => {
      if (busy.current === f) return
      busy.current = f
      const res = await fetchCustomers(f)
      busy.current = null
      if (res.kind === 'ok') {
        setStore((s) => ({ ...s, [f]: { at: res.at, data: res.data } }))
        setFailed(false)
      } else if (res.kind === 'unavailable') onUnavailable()
      else if (res.kind === 'error') setFailed(true)
    },
    [onUnavailable],
  )

  useEffect(() => {
    if (!visible) return
    if (!current || Date.now() - current.at > 30_000) void load(filter)
  }, [visible, filter])

  const data = current?.data ?? null

  const shown = useMemo(() => {
    const q = normalize(query)
    if (!q) return data?.customers ?? []
    return (data?.customers ?? []).filter((c) =>
      [c.name, c.phone, c.email].some((v) => v && normalize(v).includes(q)),
    )
  }, [data, query])

  const choose = (key: 'all' | 'subscribers') => {
    if (key === filter) return
    haptic('LIGHT')
    setFilter(key)
    navigate(key === 'all' ? '/dashboard/customers' : '/dashboard/customers?filter=subscribers', { replace: true })
  }

  return (
    <Screen visible={visible} title={filter === 'subscribers' ? 'المشتركون' : 'العملاء'} onRefresh={() => load(filter)}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">{filter === 'subscribers' ? 'المشتركون' : 'العملاء'}</h1>
            <p class="page-sub">
              {!data
                ? 'بنجهّز عملاءك…'
                : filter === 'subscribers'
                  ? `${formatNumber(data.totals.subscribers)} عميل موافق يستقبل رسايلك التسويقية`
                  : `${formatNumber(data.totals.count)} عميل سجّلوا طلبات في متجرك`}
            </p>
          </div>
        </header>

        {data && data.totals.count > 0 && (
          <section class="card sec facts rise">
            <div class="fact">
              <span class="fact-label">إجمالي العملاء</span>
              <b>{formatNumber(data.totals.count)}</b>
            </div>
            <div class="fact">
              <span class="fact-label">متوسط الإنفاق</span>
              <b>{formatMoney(data.totals.average, data.currency)}</b>
            </div>
            <div class="fact">
              <span class="fact-label">اشتروا تاني</span>
              <b>{formatNumber(data.totals.repeatRate)}%</b>
            </div>
          </section>
        )}

        <label class="search rise">
          <Icon svg={icons.search()} />
          <input
            type="search"
            placeholder="دوّر بالاسم أو الرقم أو البريد"
            value={query}
            onInput={(e) => setQuery((e.currentTarget as HTMLInputElement).value)}
            enterKeyHint="search"
          />
          {query && (
            <button type="button" class="search-clear" aria-label="مسح البحث" onClick={() => setQuery('')}>
              <Icon svg={icons.x()} />
            </button>
          )}
        </label>

        <div class="frail" role="tablist" aria-label="فلترة العملاء">
          {(
            [
              { key: 'all', label: 'كل العملاء', n: data?.totals.count ?? 0 },
              { key: 'subscribers', label: 'المشتركون', n: data?.totals.subscribers ?? 0 },
            ] as const
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={filter === t.key}
              class={`fchip${filter === t.key ? ' fchip--on' : ''}`}
              onClick={() => choose(t.key)}
            >
              {t.label}
              {t.n > 0 && <span class="fchip-n">{formatNumber(t.n)}</span>}
            </button>
          ))}
        </div>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب العملاء</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2, 3, 4].map((i) => (
                <span key={i} class="sk" style="height:84px;border-radius:20px" />
              ))}
            </div>
          )
        ) : data.customers.length === 0 ? (
          <div class="empty rise">
            <span class="empty-icon">
              <Icon svg={icons.users()} />
            </span>
            <b>{filter === 'subscribers' ? 'مافيش مشتركين لسه' : 'لسه مافيش عملاء'}</b>
            <p>أول ما يجيلك طلب، بيانات صاحبه هتتسجّل هنا تلقائيًا.</p>
          </div>
        ) : shown.length === 0 ? (
          <div class="empty empty--compact rise">
            <b>مفيش عميل بالبيانات دي</b>
            <p>جرّب جزء من الاسم أو آخر أرقام التليفون.</p>
          </div>
        ) : (
          <div class="card list rise">
            {shown.map((c) => (
              <CustomerRow key={c.id} customer={c} currency={data.currency} />
            ))}
          </div>
        )}

        {data && data.customers.length > 0 && !query && (
          <p class="fine center">العملاء مرتّبين حسب إجمالي إنفاقهم — الأعلى فوق.</p>
        )}
      </div>
    </Screen>
  )
}

function CustomerRow({ customer: c, currency }: { customer: ListCustomer; currency: string }) {
  const open = () => {
    customerPreviews.set(c.id, { ...c, currency })
    haptic('LIGHT')
    navigate(`/dashboard/customers/${c.id}`)
  }

  const act = (href: string) => (e: Event) => {
    e.stopPropagation()
    haptic('LIGHT')
    location.assign(href)
  }

  return (
    <div
      class="row crow"
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter') open()
      }}
    >
      <span class={`avatar avatar--${TIER_TONES[c.tier] ?? 'muted'}`}>{initials(c.name)}</span>
      <span class="row-main">
        <span class="row-title">
          {c.name || 'بدون اسم'}
          {c.tierLabel && <span class={`tier tier--${TIER_TONES[c.tier] ?? 'muted'}`}>{c.tierLabel}</span>}
        </span>
        <span class="row-sub">
          {c.lastOrderAt ? `آخر طلب ${formatDateTime(c.lastOrderAt).split('،')[0]}` : 'ما طلبش لسه'}
          {' · '}
          {formatNumber(c.ordersCount)} طلب
        </span>
      </span>
      <span class="crow-end">
        <b>{formatMoney(c.totalSpent, currency)}</b>
        {c.phone && (
          <span class="crow-actions">
            <button type="button" class="mini press" aria-label="اتصال" onClick={act(`tel:${c.phone}`)}>
              <Icon svg={icons.phone()} />
            </button>
            <button
              type="button"
              class="mini mini--wa press"
              aria-label="واتساب"
              onClick={act(whatsappLink(c.phone, c.whatsappText))}
            >
              <Icon svg={icons.messageCircle()} />
            </button>
          </span>
        )}
      </span>
    </div>
  )
}
