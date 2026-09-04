'use client'

import Link from 'next/link'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { SpotlightCard } from '@/components/motion'
import { cn } from '@/lib/utils'

export type StatTile = {
  label: string
  value: string
  /** التغيّر عن نفس المدة السابقة بالنسبة المئوية — null يعني مفيش مقارنة */
  change: number | null
  /** خط مصغّر — آخر ١٤ نقطة */
  spark: number[]
  href?: string
  /**
   * الاتجاه المرغوب.
   *
   * الزيادة مش دايمًا كويسة: السلات المتروكة اللي بتزيد مشكلة، وسبب
   * وجودها في اللوحة إن التاجر يشوفها بتقلّ. اللون بيتبع المعنى لا
   * الإشارة.
   */
  goodDirection?: 'up' | 'down'
}

/**
 * مربّعات الأرقام.
 *
 * ## الرقم لوحده مش معلومة
 * «١٢ طلب» مش بيقول حاجة من غير «كام كانوا الأسبوع اللي فات». نسبة
 * التغيّر والخط المصغّر بيحوّلوا الرقم لاتجاه — وده اللي التاجر
 * بيتصرّف بناءً عليه.
 */
export function StatTiles({ tiles }: { tiles: StatTile[] }) {
  return (
    <>
      {tiles.map((t) => {
        const body = (
          <SpotlightCard className="flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)] p-4">
            <span className="text-xs text-[var(--fg-muted)]">{t.label}</span>

            <span className="tabular text-2xl font-bold tracking-tight">{t.value}</span>

            <div className="mt-auto flex items-end justify-between gap-3">
              <Delta change={t.change} goodDirection={t.goodDirection ?? 'up'} />
              <Sparkline points={t.spark} />
            </div>
          </SpotlightCard>
        )

        return (
          <div key={t.label} className="h-full">
            {t.href ? (
              <Link href={t.href} className="block h-full">
                {body}
              </Link>
            ) : (
              body
            )}
          </div>
        )
      })}
    </>
  )
}

function Delta({
  change,
  goodDirection,
}: {
  change: number | null
  goodDirection: 'up' | 'down'
}) {
  if (change === null) {
    return (
      <span className="flex items-center gap-1 text-xs text-[var(--fg-subtle)]">
        <Minus className="h-3 w-3" aria-hidden="true" />
        أول مرة
      </span>
    )
  }

  const up = change >= 0
  const good = goodDirection === 'up' ? up : !up
  const Icon = up ? ArrowUpRight : ArrowDownRight

  return (
    <span
      className="flex items-center gap-1 text-xs font-medium"
      style={{ color: good ? 'var(--color-success)' : 'var(--color-danger)' }}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="tabular">{Math.abs(change)}%</span>
      <span className="text-[var(--fg-subtle)]">عن المدة اللي فاتت</span>
    </span>
  )
}

/**
 * خط مصغّر.
 *
 * بلا محاور ولا أرقام عن قصد: مكانه في مربّع ٦٠×٢٠ بكسل، وأي تفصيلة
 * زيادة فيه بتبقى ضجيجًا. الشكل بس — طالع ولا نازل.
 */
function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2 || points.every((p) => p === 0)) return null

  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1

  const d = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * 100
      const y = 100 - ((p - min) / range) * 100
      return `${i === 0 ? 'M' : 'L'}${x},${y}`
    })
    .join(' ')

  const rising = points[points.length - 1] >= points[0]

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={cn('h-6 w-16 shrink-0 overflow-visible')}
      aria-hidden="true"
    >
      <path
        d={d}
        fill="none"
        stroke={rising ? 'var(--color-success)' : 'var(--color-danger)'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        opacity="0.75"
      />
    </svg>
  )
}
