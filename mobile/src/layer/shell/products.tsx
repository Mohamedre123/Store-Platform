/**
 * قايمة المنتجات — شاشة أصلية.
 *
 * نفس محتوى صفحة المنتجات في اللوحة، بشكل تطبيق متجر: شبكة صور،
 * بحث فوري بالاسم، وفلاتر (نشط، مسوّدة، قربت تخلص، نفدت) بتشتغل من
 * غير أي رحلة للخادم لأن القايمة كلها محمّلة أصلًا.
 *
 * إضافة منتج وتعديله الكامل (المقاسات والألوان والسيو والذكاء
 * الاصطناعي) بيفتحوا فورم المنصة — وهو جوّه نفس الهيكل، ورفع الصور
 * فيه بيفتح الكاميرا أو المعرض.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import { assetUrl } from './api'
import { formatMoney, formatNumber } from './format'
import { navigate } from './navigate'
import {
  fetchProducts,
  productPreviews,
  productsVersion,
  readProductsCache,
  type ListProduct,
  type ProductsPayload,
} from './products-api'
import { Screen } from './screen'
import { Icon } from './ui'

type Filter = 'all' | 'active' | 'draft' | 'low' | 'out'

const LOW = 5

const matches = (p: ListProduct, f: Filter) =>
  f === 'all'
    ? true
    : f === 'active'
      ? p.status === 'active'
      : f === 'draft'
        ? p.status !== 'active'
        : f === 'low'
          ? p.trackInventory && p.stock > 0 && p.stock <= LOW
          : p.trackInventory && p.stock === 0

/* البحث بيتجاهل التشكيل والهمزات — «اسوره» بتلاقي «أسورة» */
const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ٰٟ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .trim()

export function ProductsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const [state, setState] = useState<{ at: number; data: ProductsPayload } | null>(readProductsCache)
  const [failed, setFailed] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const seen = useRef(productsVersion())
  const busy = useRef(false)

  const load = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    const res = await fetchProducts()
    busy.current = false
    if (res.kind === 'ok') {
      seen.current = productsVersion()
      setState({ at: res.at, data: res.data })
      setFailed(false)
    } else if (res.kind === 'unavailable') onUnavailable()
    else if (res.kind === 'error') setFailed(true)
  }, [onUnavailable])

  useEffect(() => {
    if (!visible) return
    if (!state || Date.now() - state.at > 20_000 || seen.current !== productsVersion()) void load()
  }, [visible])

  const data = state?.data ?? null

  const counts = useMemo(() => {
    const list = data?.products ?? []
    return {
      all: list.length,
      active: list.filter((p) => matches(p, 'active')).length,
      draft: list.filter((p) => matches(p, 'draft')).length,
      low: list.filter((p) => matches(p, 'low')).length,
      out: list.filter((p) => matches(p, 'out')).length,
    }
  }, [data])

  const shown = useMemo(() => {
    const q = normalize(query)
    return (data?.products ?? []).filter(
      (p) => matches(p, filter) && (!q || normalize(p.name).includes(q) || normalize(p.category ?? '').includes(q)),
    )
  }, [data, filter, query])

  const chips: Array<{ key: Filter; label: string; tone?: string }> = [
    { key: 'all', label: 'الكل' },
    { key: 'active', label: 'نشط' },
    { key: 'draft', label: 'مسوّدة' },
    { key: 'low', label: 'قربت تخلص', tone: 'warn' },
    { key: 'out', label: 'نفدت', tone: 'danger' },
  ]

  return (
    <Screen
      visible={visible}
      title="المنتجات"
      onRefresh={load}
      overlay={
        <button type="button" class="fab press" onClick={() => navigate('/dashboard/products/new')}>
          <Icon svg={icons.plus()} />
          منتج جديد
        </button>
      }
    >
      <div class="home-body home-body--fab">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">المنتجات</h1>
            <p class="page-sub">
              {data
                ? `${formatNumber(data.total)} منتج · ${formatNumber(data.active)} نشط${data.lowStock ? ` · ${formatNumber(data.lowStock)} كميته قربت تخلص` : ''}`
                : 'بنجهّز منتجاتك…'}
            </p>
          </div>
          <button type="button" class="icon-btn press" aria-label="الأقسام" onClick={() => navigate('/dashboard/products/categories')}>
            <Icon svg={icons.layers()} />
          </button>
        </header>

        <label class="search rise">
          <Icon svg={icons.search()} />
          <input
            type="search"
            placeholder="دوّر باسم المنتج أو القسم"
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

        <div class="frail" role="tablist" aria-label="فلترة المنتجات">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              role="tab"
              aria-selected={filter === c.key}
              class={`fchip${c.tone ? ` fchip--${c.tone}` : ''}${filter === c.key ? ' fchip--on' : ''}`}
              onClick={() => {
                if (c.key === filter) return
                haptic('LIGHT')
                setFilter(c.key)
              }}
            >
              {c.label}
              {counts[c.key] > 0 && <span class="fchip-n">{formatNumber(counts[c.key])}</span>}
            </button>
          ))}
        </div>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب المنتجات</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="pgrid">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span key={i} class="sk" style="aspect-ratio:3/4;border-radius:20px" />
              ))}
            </div>
          )
        ) : data.total === 0 ? (
          <div class="empty rise">
            <span class="empty-icon">
              <Icon svg={icons.package()} />
            </span>
            <b>لسه مافيش منتجات</b>
            <p>ضيف أول منتج وهيظهر في متجرك على طول.</p>
            <button type="button" class="btn btn--primary press" onClick={() => navigate('/dashboard/products/new')}>
              <Icon svg={icons.plus()} />
              ضيف أول منتج
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div class="empty empty--compact rise">
            <b>مفيش منتجات مطابقة</b>
            <p>{query ? 'جرّب اسم تاني أو امسح البحث.' : 'مفيش منتجات في الفلتر ده.'}</p>
          </div>
        ) : (
          <div class="pgrid">
            {shown.map((p, i) => (
              <ProductCard key={p.id} product={p} currency={data.currency} delay={Math.min(i, 8) * 30} />
            ))}
          </div>
        )}
      </div>
    </Screen>
  )
}

export function stockLabel(p: { trackInventory: boolean; stock: number }): { text: string; tone: string } | null {
  if (!p.trackInventory) return null
  if (p.stock === 0) return { text: 'نفدت الكمية', tone: 'danger' }
  if (p.stock <= LOW) return { text: `متبقي ${formatNumber(p.stock)}`, tone: 'warn' }
  return { text: `متبقي ${formatNumber(p.stock)}`, tone: 'muted' }
}

function ProductCard({ product: p, currency, delay }: { product: ListProduct; currency: string; delay: number }) {
  const stock = stockLabel(p)
  const open = () => {
    productPreviews.set(p.id, { ...p, currency })
    haptic('LIGHT')
    navigate(`/dashboard/products/${p.id}`)
  }

  return (
    <button type="button" class="pcard press rise" style={{ animationDelay: `${delay}ms` }} onClick={open}>
      <span class="pcard-img">
        {p.image ? <img src={assetUrl(p.image) ?? ''} alt="" loading="lazy" /> : <Icon svg={icons.image()} />}
        {p.status !== 'active' && <span class="pcard-badge">مسوّدة</span>}
      </span>
      <span class="pcard-body">
        <span class="pcard-name">{p.name}</span>
        {p.category && <span class="pcard-cat">{p.category}</span>}
        <span class="pcard-price">
          {formatMoney(p.price, currency)}
          {p.compareAtPrice && <s>{formatMoney(p.compareAtPrice, currency)}</s>}
        </span>
        {stock && <span class={`stock stock--${stock.tone}`}>{stock.text}</span>}
      </span>
    </button>
  )
}
