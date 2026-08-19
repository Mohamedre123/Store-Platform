'use client'

import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { spinWheelAction } from '@/app/s/[store]/wheel-actions'

type Prize = { id: string; label: string; color: string }

/**
 * عجلة الحظ.
 *
 * الدوران هنا عرض بصري بس — النتيجة بتيجي من الخادم قبل ما العجلة
 * تلف، والزاوية بتتحسب عشان توقف على الجايزة اللي رجعت. لو خلّينا
 * المتصفح يختار، أي حد يفتح الأدوات ويدّي نفسه الجايزة الكبيرة.
 */
export function LuckyWheel({
  storeIdentifier,
  title,
  subtitle,
  prizes,
  delaySeconds,
}: {
  storeIdentifier: string
  title: string
  subtitle: string | null
  prizes: Prize[]
  delaySeconds: number
}) {
  const [open, setOpen] = useState(false)
  const [phone, setPhone] = useState('')
  const [spinning, setSpinning] = useState(false)
  const [angle, setAngle] = useState(0)
  const [result, setResult] = useState<{ label: string; couponCode?: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const shown = useRef(false)

  const STORAGE_KEY = `zw_wheel_${storeIdentifier}`

  useEffect(() => {
    // العميل اللي لف قبل كده ما يتزنقش تاني في كل زيارة
    if (typeof window === 'undefined') return
    if (localStorage.getItem(STORAGE_KEY)) return

    const t = setTimeout(() => {
      if (!shown.current) {
        shown.current = true
        setOpen(true)
      }
    }, delaySeconds * 1000)
    return () => clearTimeout(t)
  }, [delaySeconds, STORAGE_KEY])

  if (!open || prizes.length < 2) return null

  const slice = 360 / prizes.length

  async function spin() {
    setError(null)
    setSpinning(true)

    const res = await spinWheelAction({ storeIdentifier, phone })

    if (!res.ok) {
      setError(res.error)
      setSpinning(false)
      return
    }

    // ٥ لفّات كاملة + الزاوية اللي توقف على الجايزة الفائزة
    const target = 360 * 5 + (360 - (res.index * slice + slice / 2))
    setAngle(target)

    setTimeout(() => {
      setResult({ label: res.prize.label, couponCode: res.prize.couponCode })
      setSpinning(false)
      localStorage.setItem(STORAGE_KEY, '1')
    }, 4200)
  }

  // شرائح العجلة بتدرّج مخروطي — أبسط وأخف من رسمها بـSVG
  const gradient = prizes
    .map((p, i) => `${p.color} ${i * slice}deg ${(i + 1) * slice}deg`)
    .join(', ')

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="إغلاق"
        onClick={() => {
          setOpen(false)
          localStorage.setItem(STORAGE_KEY, '1')
        }}
        className="absolute inset-0 bg-black/60"
      />

      <div className="relative w-full max-w-sm rounded-2xl bg-[var(--sf-surface)] p-6 text-center shadow-2xl">
        <button
          type="button"
          onClick={() => {
            setOpen(false)
            localStorage.setItem(STORAGE_KEY, '1')
          }}
          aria-label="إغلاق"
          className="absolute end-3 top-3 flex h-9 w-9 items-center justify-center rounded-lg opacity-60 hover:opacity-100"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>

        {result ? (
          <div className="flex flex-col gap-3 py-4">
            <span className="text-4xl">🎉</span>
            <h2 className="text-xl font-bold">مبروك!</h2>
            <p className="text-lg">{result.label}</p>
            {result.couponCode && (
              <div className="rounded-lg border-2 border-dashed border-[var(--sf-primary)] p-3">
                <span className="text-xs opacity-65">كود الخصم</span>
                <p className="text-xl font-bold tracking-widest text-[var(--sf-primary)]" dir="ltr">
                  {result.couponCode}
                </p>
                <span className="text-xs opacity-65">صالح ٧ أيام</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-2 min-h-11 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] font-semibold text-white"
            >
              يلا نتسوّق
            </button>
          </div>
        ) : (
          <>
            <h2 className="text-xl font-bold">{title}</h2>
            {subtitle && <p className="mt-1 text-sm opacity-70">{subtitle}</p>}

            <div className="relative mx-auto my-5 h-56 w-56">
              {/* المؤشّر */}
              <span
                className="absolute start-1/2 top-0 z-10 -translate-x-1/2"
                style={{
                  borderInlineStart: '10px solid transparent',
                  borderInlineEnd: '10px solid transparent',
                  borderTop: '18px solid var(--sf-primary)',
                }}
                aria-hidden="true"
              />
              <div
                className="h-full w-full rounded-full border-4 border-[var(--sf-primary)]"
                style={{
                  background: `conic-gradient(${gradient})`,
                  transform: `rotate(${angle}deg)`,
                  transition: spinning ? 'transform 4s cubic-bezier(.17,.67,.15,.99)' : undefined,
                }}
              />
            </div>

            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              dir="ltr"
              placeholder="رقم تليفونك"
              disabled={spinning}
              className="h-12 w-full rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 text-start outline-none focus:border-[var(--sf-primary)]"
            />

            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

            <button
              type="button"
              onClick={spin}
              disabled={spinning || phone.trim().length < 8}
              className="mt-3 min-h-12 w-full rounded-[var(--sf-radius)] bg-[var(--sf-primary)] font-semibold text-white disabled:opacity-50"
            >
              {spinning ? 'بتلف…' : 'لُف العجلة'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
