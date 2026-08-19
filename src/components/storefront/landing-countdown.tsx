'use client'

import { useEffect, useState } from 'react'

/**
 * عدّاد تنازلي.
 *
 * بيبدأ من أول زيارة للزائر ده وبيتخزّن محليًا — لو عمل تحديث للصفحة
 * ما يبدأش من الأول. عدّاد بيرجع لنقطة البداية مع كل تحديث بيبان مزيّفًا
 * وبيضرّ الثقة أكتر ما بيساعد.
 */
export function LandingCountdown({ title, minutes }: { title: string; minutes: number }) {
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    const key = 'zw_lp_deadline'
    let deadline = Number(sessionStorage.getItem(key))
    if (!deadline || Number.isNaN(deadline) || deadline < Date.now()) {
      deadline = Date.now() + minutes * 60_000
      sessionStorage.setItem(key, String(deadline))
    }

    const tick = () => setLeft(Math.max(0, deadline - Date.now()))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [minutes])

  if (left === null) return null

  const h = Math.floor(left / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  const s = Math.floor((left % 60_000) / 1000)
  const pad = (n: number) => String(n).padStart(2, '0')

  return (
    <section
      className="my-6 flex flex-col items-center gap-3 px-6 py-8 text-center"
      style={{ background: 'var(--lp-surface)', borderRadius: 'var(--lp-radius)' }}
    >
      {title && <span className="font-medium">{title}</span>}
      <div className="flex gap-2" dir="ltr">
        {[
          { v: h, l: 'ساعة' },
          { v: m, l: 'دقيقة' },
          { v: s, l: 'ثانية' },
        ].map((u, i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <span
              className="tabular flex h-14 w-14 items-center justify-center text-2xl font-bold text-white"
              style={{ background: 'var(--lp-primary)', borderRadius: 'var(--lp-radius)' }}
            >
              {pad(u.v)}
            </span>
            <span className="text-xs opacity-60">{u.l}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
