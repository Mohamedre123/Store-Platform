/**
 * قطع صغيرة مشتركة بين الشاشات الأصلية.
 */
import type { ComponentChildren } from 'preact'

/** أيقونة من `icons.ts` — نفس رسم lucide اللي المنصة بتستخدمه */
export function Icon({ svg, className = 'ic' }: { svg: string; className?: string }) {
  return <span class={className} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svg }} />
}

export function Delta({ change, goodDirection = 'up' }: { change: number | null; goodDirection?: 'up' | 'down' }) {
  if (change === null) return <span class="delta delta--none">جديد</span>
  const up = change >= 0
  const good = goodDirection === 'up' ? up : !up
  return (
    <span class={`delta ${good ? 'delta--up' : 'delta--down'}`}>
      {up ? '▲' : '▼'} {Math.abs(change)}%
    </span>
  )
}

/** خط مصغّر بلا محاور — الشكل بس: طالع ولا نازل */
export function Sparkline({ points }: { points: number[] }) {
  if (points.length < 2 || points.every((p) => p === 0)) return <span class="spark" />
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${(i / (points.length - 1)) * 100},${100 - ((p - min) / range) * 100}`)
    .join(' ')
  const rising = points[points.length - 1] >= points[0]
  return (
    <svg class="spark" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={rising ? 'var(--color-success, #15803d)' : 'var(--color-danger, #b91c1c)'}
        stroke-width="2.2"
        stroke-linecap="round"
        stroke-linejoin="round"
        vector-effect="non-scaling-stroke"
      />
    </svg>
  )
}

export function Ring({ ratio, tone, size = 58, children }: { ratio: number; tone: string; size?: number; children?: ComponentChildren }) {
  const r = 22
  const c = 2 * Math.PI * r
  return (
    <span class="ring" style={{ width: `${size}px`, height: `${size}px` }}>
      <svg viewBox="0 0 52 52" aria-hidden="true">
        <circle cx="26" cy="26" r={r} fill="none" stroke="var(--surface-2, #f1f2f6)" stroke-width="4.5" />
        <circle
          class="ring-value"
          cx="26"
          cy="26"
          r={r}
          fill="none"
          stroke={tone}
          stroke-width="4.5"
          stroke-linecap="round"
          stroke-dasharray={c}
          stroke-dashoffset={c * (1 - Math.max(0, Math.min(1, ratio)))}
        />
      </svg>
      <b>{children}</b>
    </span>
  )
}

export function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <div class="sec-head">
      <h2 class="sec-title">{title}</h2>
      {action && (
        <button type="button" class="sec-link" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  )
}
