/**
 * المخزون — شاشة أصلية.
 *
 * الأرقام الأربعة، فلتر «نافد / منخفض»، بحث، وتعديل الكمية بـ− و+ من
 * غير ما تفتح المنتج: الرقم بيتغيّر فورًا والحفظ بيحصل بعد ما تبطّل
 * تدوس بلحظة — فعشر ضغطات = حفظ واحد. ودوسة على الرقم نفسه بتفتح خانة
 * تكتب فيها الكمية بالظبط. كل تعديل بيتسجّل في «سجل الحركة» زي اللوحة.
 */
import { useMemo, useRef, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { assetUrl } from './api'
import { inventoryData, type InventoryItem } from './business-api'
import { formatDateTime, formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { navigate } from './navigate'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

type Filter = 'all' | 'low' | 'out'
type Kind = 'product' | 'variant'

const MINUS =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>'

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, '')

export function InventoryScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(inventoryData, visible, onUnavailable)
  const [filter, setFilter] = useState<Filter>('all')
  const [query, setQuery] = useState('')
  const [edits, setEdits] = useState<Record<string, number>>({})
  const [saving, setSaving] = useState<Record<string, 'saving' | 'saved'>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [exact, setExact] = useState<{ kind: Kind; id: string; name: string; value: string } | null>(null)
  const timers = useRef<Record<string, number>>({})
  const refresh = useRef(0)
  /*
    نسخة فورية من التعديلات: ضغطتين ورا بعض على «+» بيحصلوا قبل ما الـstate
    يتحدّث، فالتانية كانت بتقرا الرقم القديم وتضيع زيادة. الـref بيتحدّث في
    نفس اللحظة.
  */
  const editsRef = useRef<Record<string, number>>({})

  const keyOf = (kind: Kind, id: string) => `${kind}:${id}`
  const valueOf = (kind: Kind, id: string, base: number) => editsRef.current[keyOf(kind, id)] ?? edits[keyOf(kind, id)] ?? base

  const effective = (item: InventoryItem) =>
    item.variants.length
      ? item.variants.reduce((n, v) => n + valueOf('variant', v.id, v.stock), 0)
      : valueOf('product', item.id, item.stock)

  const level = (item: InventoryItem): 'out' | 'low' | 'ok' => {
    const e = effective(item)
    return e <= 0 ? 'out' : e <= item.threshold ? 'low' : 'ok'
  }

  const save = async (kind: Kind, id: string, value: number) => {
    const k = keyOf(kind, id)
    setSaving((s) => ({ ...s, [k]: 'saving' }))
    const res = await postAppJson('/api/app/inventory/stock', { kind, id, stock: value })
    if (!res.ok) {
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      delete editsRef.current[k]
      setEdits((e) => {
        const next = { ...e }
        delete next[k]
        return next
      })
      setSaving((s) => {
        const next = { ...s }
        delete next[k]
        return next
      })
      return
    }
    setSaving((s) => ({ ...s, [k]: 'saved' }))
    window.setTimeout(
      () =>
        setSaving((s) => {
          if (s[k] !== 'saved') return s
          const next = { ...s }
          delete next[k]
          return next
        }),
      1400,
    )
    /* الأرقام اللي فوق وسجل الحركة بيتحدّثوا بعد ما التعديلات تهدى */
    clearTimeout(refresh.current)
    refresh.current = window.setTimeout(() => void load(), 2500)
  }

  const setValue = (kind: Kind, id: string, value: number, immediate = false) => {
    const k = keyOf(kind, id)
    const next = Math.max(0, Math.trunc(value))
    editsRef.current = { ...editsRef.current, [k]: next }
    setEdits((e) => ({ ...e, [k]: next }))
    clearTimeout(timers.current[k])
    if (immediate) void save(kind, id, next)
    else timers.current[k] = window.setTimeout(() => void save(kind, id, next), 700)
  }

  const bump = (kind: Kind, id: string, base: number, delta: number) => {
    const current = valueOf(kind, id, base)
    if (current + delta < 0) return
    haptic('LIGHT')
    setValue(kind, id, current + delta)
  }

  const counts = useMemo(() => {
    const items = data?.items ?? []
    return {
      all: items.length,
      low: items.filter((i) => level(i) === 'low').length,
      out: items.filter((i) => level(i) === 'out').length,
    }
  }, [data, edits])

  const shown = useMemo(() => {
    const q = normalize(query)
    return (data?.items ?? []).filter((item) => {
      if (filter !== 'all' && level(item) !== filter) return false
      if (!q) return true
      return [item.name, item.sku ?? '', ...item.variants.map((v) => v.title)].some((t) => normalize(t).includes(q))
    })
  }, [data, filter, query, edits])

  const stepper = (kind: Kind, id: string, name: string, base: number) => {
    const value = valueOf(kind, id, base)
    const state = saving[keyOf(kind, id)]
    return (
      <div class="inv-controls">
        <span class={`inv-state${state === 'saved' ? ' inv-state--saved' : ''}`}>
          {state === 'saving' ? 'بيتحفظ…' : state === 'saved' ? 'اتحفظ ✓' : ''}
        </span>
        <div class="stepper">
          <button type="button" aria-label="نقّص واحد" disabled={value <= 0} onClick={() => bump(kind, id, base, -1)}>
            <Icon svg={MINUS} />
          </button>
          <button
            type="button"
            class="stepper-val"
            aria-label="اكتب الكمية"
            onClick={() => {
              haptic('LIGHT')
              setExact({ kind, id, name, value: String(value) })
            }}
          >
            {formatNumber(value)}
          </button>
          <button type="button" aria-label="زوّد واحد" onClick={() => bump(kind, id, base, 1)}>
            <Icon svg={icons.plus()} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <Screen visible={visible} title="المخزون" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">المخزون</h1>
            <p class="page-sub">كمياتك وحركتها — وعدّلها من هنا على طول</p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب المخزون</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} class="sk" style="height:118px;border-radius:20px" />
              ))}
            </div>
          )
        ) : data.items.length === 0 ? (
          <div class="empty rise">
            <span class="empty-icon">
              <Icon svg={icons.package()} />
            </span>
            <b>مافيش منتجات بتتبّع مخزون</b>
            <p>فعّل «تتبّع المخزون» في صفحة المنتج، وهيظهر هنا.</p>
            <button type="button" class="btn btn--primary press" onClick={() => navigate('/dashboard/products')}>
              روح للمنتجات
            </button>
          </div>
        ) : (
          <>
            <div class="an-kpis rise">
              <div class="card an-kpi">
                <span class="an-kpi-label">قطع في المخزن</span>
                <b class="an-kpi-value">{formatNumber(data.stats.units)}</b>
              </div>
              <div class="card an-kpi">
                <span class="an-kpi-label">قيمته بالتكلفة</span>
                <b class="an-kpi-value">{data.stats.valueLabel}</b>
              </div>
              <div class="card an-kpi">
                <span class="an-kpi-label">نافد</span>
                <b class={`an-kpi-value${data.stats.out > 0 ? ' an-kpi-value--neg' : ''}`}>{formatNumber(data.stats.out)}</b>
              </div>
              <div class="card an-kpi">
                <span class="an-kpi-label">مخزون منخفض</span>
                <b class="an-kpi-value" style={data.stats.low > 0 ? { color: 'var(--color-warning,#a16207)' } : undefined}>
                  {formatNumber(data.stats.low)}
                </b>
              </div>
            </div>

            <label class="search rise">
              <Icon svg={icons.search()} />
              <input
                type="search"
                placeholder="دوّر باسم المنتج أو الكود"
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

            <div class="frail" role="tablist" aria-label="فلترة المخزون">
              {(
                [
                  { key: 'all', label: 'الكل', n: counts.all },
                  { key: 'low', label: 'مخزون منخفض', n: counts.low },
                  { key: 'out', label: 'نافد', n: counts.out },
                ] as const
              ).map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={filter === t.key}
                  class={`fchip${filter === t.key ? ' fchip--on' : ''}${t.key !== 'all' && t.n > 0 ? ' fchip--warn' : ''}`}
                  onClick={() => {
                    haptic('LIGHT')
                    setFilter(t.key)
                  }}
                >
                  {t.label}
                  {t.n > 0 && <span class="fchip-n">{formatNumber(t.n)}</span>}
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <div class="empty empty--compact rise">
                <b>{query ? 'مفيش منتج بالاسم ده' : 'مافيش منتجات في الفلتر ده'}</b>
                <p>{query ? 'جرّب جزء من الاسم أو الكود.' : 'وده خبر كويس.'}</p>
              </div>
            ) : (
              <div class="card list rise">
                {shown.map((item) => {
                  const lv = level(item)
                  const e = effective(item)
                  const open = expanded[item.id] ?? false
                  const img = assetUrl(item.image)
                  return (
                    <div key={item.id} class="inv-item">
                      <div class="inv-top">
                        <button
                          type="button"
                          class="inv-thumb press"
                          aria-label={`فتح ${item.name}`}
                          onClick={() => navigate(`/dashboard/products/${item.id}`)}
                        >
                          {img ? <img src={img} alt="" loading="lazy" /> : <Icon svg={icons.image()} />}
                        </button>
                        <span class="inv-name">
                          <b>{item.name}</b>
                          {item.sku && <small>{item.sku}</small>}
                        </span>
                        <span class={`inv-chip inv-chip--${lv}`}>
                          {lv === 'out' ? 'نافد' : lv === 'low' ? `فاضل ${formatNumber(e)}` : `${formatNumber(e)} قطعة`}
                        </span>
                      </div>

                      {item.variants.length === 0 ? (
                        stepper('product', item.id, item.name, item.stock)
                      ) : (
                        <>
                          <button
                            type="button"
                            class="inv-toggle"
                            onClick={() => {
                              haptic('LIGHT')
                              setExpanded((x) => ({ ...x, [item.id]: !open }))
                            }}
                          >
                            {open ? 'اقفل المتغيّرات' : `${formatNumber(item.variants.length)} متغيّر — عدّل كل واحد`}
                          </button>
                          {open && (
                            <div class="inv-variants">
                              {item.variants.map((v) => (
                                <div key={v.id} class="inv-variant">
                                  <span>{v.title}</span>
                                  {stepper('variant', v.id, `${item.name} — ${v.title}`, v.stock)}
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {data.movements.length > 0 && (
              <>
                <div class="mk-sec rise">
                  <b>سجل الحركة</b>
                  <small>آخر تعديلات الكميات وسببها</small>
                </div>
                <div class="card list rise">
                  {data.movements.map((m) => (
                    <div key={m.id} class="row">
                      <span class={`mv-delta ${m.delta > 0 ? 'mv-delta--in' : 'mv-delta--out'}`}>
                        {m.delta > 0 ? `+${formatNumber(m.delta)}` : `−${formatNumber(Math.abs(m.delta))}`}
                      </span>
                      <span class="row-main">
                        <span class="row-title">{m.productName}</span>
                        <span class="row-sub">
                          {m.reasonLabel}
                          {m.note ? ` · ${m.note}` : ''} · {formatDateTime(m.createdAt)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(exact)} title="الكمية بالظبط" onClose={() => setExact(null)}>
        {exact && (
          <form
            class="verify"
            onSubmit={(e) => {
              e.preventDefault()
              const n = Number(exact.value)
              if (!Number.isFinite(n) || n < 0) {
                toast('اكتب رقم صحيح', { tone: 'danger' })
                return
              }
              setValue(exact.kind, exact.id, n, true)
              setExact(null)
            }}
          >
            <p class="verify-current">
              {exact.name}
            </p>
            <input
              class="verify-field"
              type="number"
              inputMode="numeric"
              min={0}
              dir="ltr"
              value={exact.value}
              onInput={(e) => setExact({ ...exact, value: (e.currentTarget as HTMLInputElement).value })}
            />
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setExact(null)}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press">
                <Icon svg={icons.check()} />
                احفظ
              </button>
            </div>
          </form>
        )}
      </Sheet>
    </Screen>
  )
}
