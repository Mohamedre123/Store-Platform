/**
 * رسم الأداء التفاعلي.
 *
 * ## بالإصبع لا بالماوس
 * على الويب الرقم بيظهر عند تمرير الماوس. هنا التاجر بيسحب صباعه على
 * الرسم والرقم بيتغيّر تحته يوم بيوم مع اهتزاز خفيف في كل يوم — نفس
 * إحساس رسوم تطبيقات البنوك والبورصة.
 *
 * الوقت من الشمال لليمين حتى في واجهة عربية: ده العرف في الرسوم
 * البيانية، والعكس بيخلّي «النهارده» يبان في أول الرسم.
 */
import { useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import type { DayPoint, Totals } from './api'
import { formatBps, formatMoney, formatNumber, pctChange } from './format'
import { Delta } from './ui'

type Metric = 'revenue' | 'orders' | 'sessions' | 'conversion'

const METRICS: Array<{ key: Metric; label: string; total: keyof Totals }> = [
  { key: 'revenue', label: 'المبيعات', total: 'revenue' },
  { key: 'orders', label: 'الطلبات', total: 'orders' },
  { key: 'sessions', label: 'الزيارات', total: 'sessions' },
  { key: 'conversion', label: 'التحويل', total: 'conversionBps' },
]

/** منحنى ناعم بين النقط — الخط المكسور بيبان رسم إكسيل */
function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (!points.length) return ''
  let d = `M${points[0].x},${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur = points[i]
    const cx = (prev.x + cur.x) / 2
    d += ` C${cx},${prev.y} ${cx},${cur.y} ${cur.x},${cur.y}`
  }
  return d
}

export function HeroChart({
  series,
  current,
  previous,
  currency,
}: {
  series: DayPoint[]
  current: Totals
  previous: Totals
  currency: string
}) {
  const [metricIndex, setMetricIndex] = useState(0)
  const [scrub, setScrub] = useState<number | null>(null)
  const lastScrub = useRef<number | null>(null)
  const metric = METRICS[metricIndex]

  const values = series.map((d) => d[metric.key])
  const max = Math.max(1, ...values)
  const points = values.map((v, i) => ({
    x: values.length === 1 ? 50 : (i / (values.length - 1)) * 100,
    y: 100 - (v / max) * 80 - 10,
  }))
  const line = smoothPath(points)
  const area = `${line} L100,100 L0,100 Z`

  const format = (v: number) =>
    metric.key === 'revenue' ? formatMoney(v, currency) : metric.key === 'conversion' ? formatBps(v) : formatNumber(v)

  const total = current[metric.total]
  const change = pctChange(total, previous[metric.total])
  const active = scrub ?? null
  const hasAny = values.some((v) => v > 0)

  const scrubAt = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const index = Math.round(ratio * (values.length - 1))
    if (index !== lastScrub.current) {
      lastScrub.current = index
      haptic('LIGHT')
      setScrub(index)
    }
  }

  const release = () => {
    lastScrub.current = null
    setScrub(null)
  }

  const pick = (i: number) => {
    if (i === metricIndex) return
    haptic('LIGHT')
    setMetricIndex(i)
  }

  return (
    <section class="card hero">
      <div class="seg" role="tablist" aria-label="المقياس">
        <span class="seg-thumb" style={{ transform: `translateX(${-metricIndex * 100}%)` }} />
        {METRICS.map((m, i) => (
          <button key={m.key} type="button" role="tab" aria-selected={i === metricIndex} onClick={() => pick(i)}>
            {m.label}
          </button>
        ))}
      </div>

      <div class="hero-head">
        <span class="hero-caption">{active === null ? 'آخر ١٤ يوم' : series[active].label}</span>
        <strong class="hero-value">{active === null ? format(total) : format(values[active])}</strong>
        <div class="hero-sub">{active === null ? <><Delta change={change} /><span>عن الـ١٤ يوم اللي قبلهم</span></> : <span>&nbsp;</span>}</div>
      </div>

      <div
        class="chart"
        onPointerDown={(e) => {
          const el = e.currentTarget as HTMLElement
          el.setPointerCapture?.(e.pointerId)
          scrubAt(e.clientX, el)
        }}
        onPointerMove={(e) => {
          if (lastScrub.current === null && e.pointerType === 'mouse' && e.buttons === 0) return
          scrubAt(e.clientX, e.currentTarget as HTMLElement)
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={release}
      >
        {hasAny ? (
          <svg key={metric.key} class="chart-svg" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="zw-hero-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="var(--primary, #634b9a)" stop-opacity="0.28" />
                <stop offset="100%" stop-color="var(--primary, #634b9a)" stop-opacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#zw-hero-grad)" />
            <path class="chart-line" d={line} />
          </svg>
        ) : (
          <div class="chart-empty">لسه مفيش بيانات في المدة دي</div>
        )}

        {hasAny && active !== null && (
          <>
            <span class="chart-guide" style={{ left: `${points[active].x}%` }} />
            <span class="chart-dot" style={{ left: `${points[active].x}%`, top: `${points[active].y}%` }} />
          </>
        )}
      </div>

      <div class="chart-x" aria-hidden="true">
        <span>{series[0]?.label}</span>
        <span>{series[Math.floor(series.length / 2)]?.label}</span>
        <span>النهارده</span>
      </div>
    </section>
  )
}
