'use client'

import { useState, useTransition } from 'react'
import { CalendarClock, Clock, Phone, Save, User } from 'lucide-react'
import { Alert, Card } from '@/components/ui'
import { BOOKING_STATUSES, DAY_NAMES, bookingStatusMeta, type BookingHours } from '@/lib/bookings-meta'
import { saveBookingHoursAction, setBookingStatusAction } from './actions'

export type BookingRow = {
  id: string
  productName: string | null
  customerName: string | null
  customerPhone: string | null
  startsAt: Date
  endsAt: Date
  status: string
  notes: string | null
  orderNumber: number | null
}

/**
 * شاشة الحجوزات.
 *
 * التاجر بيفتحها الصبح عشان يعرف يومه: مين جاي وإمتى. عشان كده
 * **الترتيب بالوقت لا بتاريخ التسجيل**، واللي فات بيتفصل عن اللي
 * جاي — القايمة اللي بتخلط الاتنين بتخلّيه يدوّر على النهارده.
 */
export function BookingsManager({
  bookings,
  hours,
  enabled,
}: {
  bookings: BookingRow[]
  hours: BookingHours
  enabled: boolean
}) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const now = Date.now()
  const upcoming = bookings.filter((b) => new Date(b.endsAt).getTime() >= now)
  const past = bookings.filter((b) => new Date(b.endsAt).getTime() < now)

  return (
    <div className="flex flex-col gap-8">
      {msg && <Alert tone={msg.ok ? 'success' : 'danger'}>{msg.text}</Alert>}

      <HoursForm
        hours={hours}
        enabled={enabled}
        onMessage={setMsg}
      />

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">المواعيد الجاية ({upcoming.length})</h2>
        {upcoming.length === 0 ? (
          <Card className="px-5 py-8 text-center text-sm text-[var(--fg-muted)]">
            مفيش مواعيد محجوزة. المواعيد بتظهر هنا أول ما عميل يحجز خدمة من متجرك.
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {upcoming.map((b) => (
              <BookingCard key={b.id} row={b} onMessage={setMsg} />
            ))}
          </div>
        )}
      </section>

      {past.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="font-semibold">اللي فات</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {past.slice(0, 20).map((b) => (
              <BookingCard key={b.id} row={b} onMessage={setMsg} muted />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}

function BookingCard({
  row,
  onMessage,
  muted,
}: {
  row: BookingRow
  onMessage: (m: { ok: boolean; text: string }) => void
  muted?: boolean
}) {
  const [status, setStatus] = useState(row.status)
  const [pending, start] = useTransition()
  const meta = bookingStatusMeta(status)

  const when = new Date(row.startsAt)
  const until = new Date(row.endsAt)

  return (
    <Card className={`flex flex-col gap-3 p-4 ${muted ? 'opacity-70' : ''}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]">
          <CalendarClock className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">{row.productName ?? 'خدمة'}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--fg-muted)]">
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" aria-hidden="true" />
              {when.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}
              {' · '}
              {when.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
              {' — '}
              {until.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </p>
        </div>

        <span
          className="shrink-0 rounded-md px-2 py-0.5 text-xs font-medium"
          style={{ background: meta.bg, color: meta.fg }}
        >
          {meta.label}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[var(--fg-muted)]">
        <span className="inline-flex items-center gap-1">
          <User className="h-3 w-3" aria-hidden="true" />
          {row.customerName ?? 'بدون اسم'}
        </span>
        {row.customerPhone && (
          <a
            href={`tel:${row.customerPhone}`}
            className="inline-flex items-center gap-1 text-[var(--primary)] hover:underline"
          >
            <Phone className="h-3 w-3" aria-hidden="true" />
            <bdi dir="ltr">{row.customerPhone}</bdi>
          </a>
        )}
        {row.orderNumber && <span className="tabular">طلب #{row.orderNumber}</span>}
      </div>

      {row.notes && (
        <p className="rounded-lg bg-[var(--surface-2)] px-3 py-2 text-xs leading-relaxed text-[var(--fg-muted)]">
          {row.notes}
        </p>
      )}

      <div className="flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-3">
        {BOOKING_STATUSES.map((s) => (
          <button
            key={s.key}
            type="button"
            disabled={pending || status === s.key}
            onClick={() =>
              start(async () => {
                const prev = status
                setStatus(s.key)
                const res = await setBookingStatusAction(row.id, s.key)
                if (res?.error) {
                  setStatus(prev)
                  onMessage({ ok: false, text: res.error })
                }
              })
            }
            className={`min-h-9 rounded-lg px-3 text-xs font-medium transition-colors ${
              status === s.key
                ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                : 'bg-[var(--surface-2)] text-[var(--fg-muted)] hover:bg-[var(--border)]'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>
    </Card>
  )
}

function HoursForm({
  hours,
  enabled: initialEnabled,
  onMessage,
}: {
  hours: BookingHours
  enabled: boolean
  onMessage: (m: { ok: boolean; text: string }) => void
}) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [days, setDays] = useState<number[]>(hours.days)
  const [from, setFrom] = useState(hours.from)
  const [to, setTo] = useState(hours.to)
  const [slotMinutes, setSlotMinutes] = useState(String(hours.slotMinutes))
  const [pending, start] = useTransition()

  const field =
    'min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none'

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">مواعيد العمل</h2>
          <p className="mt-0.5 text-sm text-[var(--fg-muted)]">
            المواعيد المتاحة للحجز بتتحسب من هنا. المنتج لازم يكون نوعه «خدمة» عشان يظهر
            له تقويم في المتجر.
          </p>
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          aria-label={enabled ? 'إيقاف الحجوزات' : 'تفعيل الحجوزات'}
          onClick={() => setEnabled((v) => !v)}
          className={`relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors ${
            enabled ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]'
          }`}
        >
          <span
            className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
              enabled ? 'start-0.5' : 'start-[1.375rem]'
            }`}
          />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {DAY_NAMES.map((name, i) => {
          const on = days.includes(i)
          return (
            <button
              key={name}
              type="button"
              aria-pressed={on}
              onClick={() => setDays((v) => (on ? v.filter((d) => d !== i) : [...v, i]))}
              className={`min-h-9 rounded-lg px-3 text-xs font-medium transition-colors ${
                on
                  ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                  : 'bg-[var(--surface-2)] text-[var(--fg-muted)]'
              }`}
            >
              {name}
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">من</span>
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">لحد</span>
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">كل قد إيه معاد</span>
          <select
            value={slotMinutes}
            onChange={(e) => setSlotMinutes(e.target.value)}
            className={field}
          >
            <option value="15">١٥ دقيقة</option>
            <option value="30">نص ساعة</option>
            <option value="60">ساعة</option>
            <option value="120">ساعتين</option>
          </select>
        </label>
      </div>

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await saveBookingHoursAction({
              enabled,
              days,
              from,
              to,
              slotMinutes: Number(slotMinutes),
            })
            onMessage(
              res?.error
                ? { ok: false, text: res.error }
                : { ok: true, text: 'اتحفظ. المواعيد بتظهر للعملاء فورًا.' },
            )
          })
        }
        className="flex min-h-10 w-fit items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-60"
      >
        <Save className="h-4 w-4" aria-hidden="true" />
        {pending ? 'بيتحفظ…' : 'حفظ'}
      </button>
    </Card>
  )
}
