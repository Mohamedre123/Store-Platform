'use client'

import { useId, useMemo, useState } from 'react'
import { formatMoney } from '@/lib/utils'
import { cn } from '@/lib/utils'

export type MetricKey = 'sessions' | 'revenue' | 'orders' | 'conversion'

export type OverviewSeries = {
  label: string
  sessions: number
  revenue: number
  orders: number
  /** نسبة التحويل بنقاط الأساس — 250 = 2.5% */
  conversion: number
}

const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: 'sessions', label: 'الزيارات' },
  { key: 'revenue', label: 'المبيعات' },
  { key: 'orders', label: 'الطلبات' },
  { key: 'conversion', label: 'معدل التحويل' },
]

/**
 * رسم أداء المتجر بتبويبات.
 *
 * ## ليه خط مساحي مش أعمدة
 * الأعمدة بتقرا كويس لأربعتاشر عمودًا، وبتبقى شعر متلاصق لتلاتين
 * يوم. الخط بيوصّل الاتجاه — وده اللي التاجر بيدوّر عليه هنا:
 * بيطلع ولا بينزل، مش «يوم ٩ كام بالظبط».
 *
 * ## ومرسوم بـSVG بلا مكتبة
 * أي مكتبة رسوم بتزوّد ٤٠ كيلو على أول صفحة بيفتحها التاجر كل يوم.
 * اللي محتاجينه — مسار وتدرّج ونقطة عند التمرير — أربع سطور رياضة.
 *
 * ## والتبويبات بتبدّل المقياس لا الصفحة
 * كل الأرقام محمّلة أصلًا مع الصفحة، فالتبديل فوري بلا أي رحلة
 * للخادم. التاجر بيقارن الزيارات بالمبيعات في ثانية.
 */
export function OverviewChart({
  data,
  currency,
}: {
  data: OverviewSeries[]
  currency: string
}) {
  const [metric, setMetric] = useState<MetricKey>('revenue')
  const [hover, setHover] = useState<number | null>(null)
  const gradientId = useId()

  const values = useMemo(() => data.map((d) => d[metric]), [data, metric])
  const max = Math.max(1, ...values)

  const format = (v: number) =>
    metric === 'revenue'
      ? formatMoney(v, currency)
      : metric === 'conversion'
        ? `${(v / 100).toFixed(1)}%`
        : String(v)

  /*
    الإحداثيات في مساحة 0→100 ثم SVG بيمدّها.

    `preserveAspectRatio="none"` بيخلّي الرسم يملا أي عرض من غير ما
    نحسب البكسل — فالرسم بيتصرّف صح على الموبايل والديسكتوب بنفس
    الكود.
  */
  const points = values.map((v, i) => ({
    x: values.length === 1 ? 50 : (i / (values.length - 1)) * 100,
    y: 100 - (v / max) * 88 - 6,
  }))

  const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
  const area = `${line} L100,100 L0,100 Z`

  const active = hover ?? values.length - 1
  const activePoint = points[active]

  const hasAny = values.some((v) => v > 0)

  return (
    <div className="flex flex-col gap-4">
      {/* التبويبات */}
      <div className="scroll-x flex gap-1.5 pb-0.5">
        {METRICS.map((m) => (
          <button
            key={m.key}
            type="button"
            onClick={() => setMetric(m.key)}
            aria-pressed={metric === m.key}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              metric === m.key
                ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* القيمة الحالية */}
      <div className="flex items-baseline gap-2">
        <span className="tabular text-2xl font-bold tracking-tight">
          {format(values[active] ?? 0)}
        </span>
        <span className="text-xs text-[var(--fg-subtle)]">{data[active]?.label}</span>
      </div>

      {hasAny ? (
        <div
          className="relative h-44"
          onMouseLeave={() => setHover(null)}
          onTouchEnd={() => setHover(null)}
        >
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="h-full w-full overflow-visible"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.28" />
                <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* خطوط الشبكة — أربعة بس، أكتر من كده بيزحم الرسم */}
            {[6, 29, 53, 76].map((y) => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="100"
                y2={y}
                stroke="var(--border)"
                strokeWidth="0.4"
                vectorEffect="non-scaling-stroke"
              />
            ))}

            <path d={area} fill={`url(#${gradientId})`} />
            <path
              d={line}
              fill="none"
              stroke="var(--primary)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              className="chart-line"
            />

            {activePoint && (
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r="3"
                fill="var(--surface)"
                stroke="var(--primary)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            )}
          </svg>

          {/*
            مناطق التمرير فوق الرسم.

            الـSVG ممدود بـ`preserveAspectRatio="none"`، فأي منطقة
            تفاعل جوّاه بتتشوّه معاه. الطبقة دي عناصر عادية بعرض
            متساوٍ — بتشتغل باللمس والماوس بنفس الدقة.
          */}
          <div className="absolute inset-0 flex">
            {data.map((d, i) => (
              <button
                key={i}
                type="button"
                aria-label={`${d.label}: ${format(values[i])}`}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onTouchStart={() => setHover(i)}
                className="h-full flex-1 focus:outline-none"
              />
            ))}
          </div>

          {hover !== null && activePoint && (
            <span
              className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-[var(--fg)] px-2 py-1 text-xs font-medium text-[var(--bg)] shadow-lg"
              style={{
                /* RTL: الرسم بيمشي من الشمال، فالنسبة بتتقلب */
                insetInlineStart: `${points[hover].x}%`,
                top: `calc(${points[hover].y}% - 2.2rem)`,
              }}
            >
              {format(values[hover])}
            </span>
          )}
        </div>
      ) : (
        <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--fg-muted)]">
          لسه مافيش بيانات في الفترة دي
        </div>
      )}

      <div className="flex justify-between text-[10px] text-[var(--fg-subtle)]">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}
