'use client'

import { useEffect, useState, useTransition } from 'react'
import { CalendarDays, Loader2 } from 'lucide-react'
import { slotsAction } from '@/app/s/[store]/booking-actions'
import type { Slot } from '@/lib/bookings-meta'

/**
 * اختيار معاد الخدمة.
 *
 * **المعاد بيتخزّن في المتصفح مع السلة** عشان الشيك أوت يلاقيه.
 * الخدمة مش قطعة تتحط في سلة وخلاص — لازم معاها وقت، والوقت ده
 * بيتبعت مع الطلب.
 *
 * التواريخ المعروضة أسبوع قدّام بس: التاجر بيغيّر مواعيده وبيقفل
 * أيام، وحجز بعد شهرين على مواعيد النهارده وعد مش مضمون.
 */
const DAYS_AHEAD = 14

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function SlotPicker({
  storeIdentifier,
  productId,
  accent,
}: {
  storeIdentifier: string
  productId: string
  accent: string
}) {
  const dates = Array.from({ length: DAYS_AHEAD }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i)
    return d
  })

  const [date, setDate] = useState(() => isoDate(dates[0]))
  const [slots, setSlots] = useState<Slot[]>([])
  const [chosen, setChosen] = useState<string | null>(null)
  const [pending, start] = useTransition()

  useEffect(() => {
    start(async () => {
      const res = await slotsAction({ storeIdentifier, productId, date })
      setSlots(res)
      setChosen(null)
    })
  }, [date, productId, storeIdentifier])

  /**
   * المعاد المختار بيتحفظ محليًا.
   *
   * السلة بتتخزّن في localStorage، والشيك أوت بيقراها من هناك.
   * المعاد لازم يمشي معاها بنفس الطريقة — وإلا العميل يختار معادًا
   * ويوصل الشيك أوت ويلاقيه ضاع.
   */
  const choose = (slot: Slot) => {
    setChosen(slot.startsAt)
    try {
      const raw = localStorage.getItem('zw_bookings')
      const map = raw ? (JSON.parse(raw) as Record<string, string>) : {}
      map[productId] = slot.startsAt
      localStorage.setItem('zw_bookings', JSON.stringify(map))
    } catch {}
  }

  return (
    <div className="flex flex-col gap-3 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 p-4">
      <div className="flex items-center gap-2">
        <CalendarDays className="h-4 w-4" style={{ color: accent }} aria-hidden="true" />
        <span className="font-medium">اختار معادك</span>
      </div>

      <div className="scroll-x -mx-1 flex gap-2 px-1 pb-1">
        {dates.map((d) => {
          const value = isoDate(d)
          const on = value === date
          return (
            <button
              key={value}
              type="button"
              onClick={() => setDate(value)}
              aria-pressed={on}
              className="flex min-h-16 w-16 shrink-0 flex-col items-center justify-center rounded-[var(--sf-radius)] border text-xs transition-colors"
              style={{
                borderColor: on ? accent : 'color-mix(in srgb, currentColor 15%, transparent)',
                background: on ? `color-mix(in srgb, ${accent} 10%, transparent)` : undefined,
                color: on ? accent : undefined,
              }}
            >
              <span className="font-semibold">
                {d.toLocaleDateString('ar-EG', { weekday: 'short' })}
              </span>
              <span className="tabular mt-0.5 text-base font-bold">{d.getDate()}</span>
              <span className="opacity-60">
                {d.toLocaleDateString('ar-EG', { month: 'short' })}
              </span>
            </button>
          )
        })}
      </div>

      {pending ? (
        <p className="flex items-center gap-2 py-3 text-sm opacity-65">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          بنشوف المتاح…
        </p>
      ) : slots.length === 0 ? (
        <p className="py-3 text-sm opacity-65">مفيش مواعيد متاحة في اليوم ده. جرّب يومًا تاني.</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {slots.map((s) => {
            const on = chosen === s.startsAt
            return (
              <button
                key={s.startsAt}
                type="button"
                disabled={!s.available}
                onClick={() => choose(s)}
                aria-pressed={on}
                className="min-h-11 rounded-[var(--sf-radius)] border text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40 disabled:line-through"
                style={{
                  borderColor: on ? accent : 'color-mix(in srgb, currentColor 15%, transparent)',
                  background: on ? accent : undefined,
                  color: on ? '#fff' : undefined,
                }}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      )}

      {chosen && (
        <p className="text-sm" style={{ color: accent }}>
          معادك:{' '}
          {new Date(chosen).toLocaleString('ar-EG', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </p>
      )}
    </div>
  )
}
