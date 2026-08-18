'use client'

import { useState } from 'react'
import { formatMoney } from '@/lib/utils'

/**
 * رسم بياني بسيط للإيرادات اليومية — أعمدة مرسومة بـCSS، من غير أي
 * مكتبة خارجية عشان يفضل خفيف ومتوافق مع كل المتصفحات. بيشتغل RTL
 * تلقائيًا (أول يوم يمين).
 */
export function RevenueChart({
  data,
  currency,
}: {
  data: Array<{ label: string; value: number }>
  currency: string
}) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))

  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-40 items-end gap-1.5">
        {data.map((d, i) => {
          const pct = (d.value / max) * 100
          const active = hover === i
          return (
            <div
              key={i}
              className="group relative flex flex-1 flex-col items-center justify-end"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              {active && (
                <div className="absolute -top-9 z-10 whitespace-nowrap rounded-md bg-[var(--fg)] px-2 py-1 text-xs font-medium text-[var(--bg)] shadow">
                  {formatMoney(d.value, currency)}
                </div>
              )}
              <div
                className="w-full rounded-t transition-all"
                style={{
                  height: `${Math.max(pct, 2)}%`,
                  background: active || d.value === max ? 'var(--primary)' : 'var(--primary-soft)',
                  minHeight: 3,
                }}
              />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-[var(--fg-subtle)]">
        <span>{data[0]?.label}</span>
        <span>{data[Math.floor(data.length / 2)]?.label}</span>
        <span>{data[data.length - 1]?.label}</span>
      </div>
    </div>
  )
}
