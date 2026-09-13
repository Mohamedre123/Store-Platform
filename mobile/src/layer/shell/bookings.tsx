/**
 * الحجوزات — شاشة أصلية.
 *
 * التاجر بيفتحها الصبح عشان يعرف يومه: المواعيد الجاية بالترتيب ومتقسّمة
 * بالأيام («النهارده»، «بكرة»…)، وكل حجز بحالته واتصال بدوسة. مواعيد
 * العمل (أيام وساعات ومدة المعاد) بتتعدّل من لوحة تحت.
 */
import { useMemo, useState } from 'preact/hooks'
import { haptic, hapticNotify } from '../bridge'
import { toast } from '../dom'
import { icons } from '../icons'
import { formatNumber } from './format'
import { postAppJson, useResource } from './http'
import { bookingsData, type Booking, type BookingsPayload } from './ops-api'
import { Screen, Sheet } from './screen'
import { Icon } from './ui'

const CALENDAR =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/></svg>'

/* الأسبوع في مصر بيبدأ السبت */
const WEEK = [6, 0, 1, 2, 3, 4, 5]
const SLOTS = [
  { value: 15, label: '١٥ دقيقة' },
  { value: 30, label: 'نص ساعة' },
  { value: 60, label: 'ساعة' },
  { value: 120, label: 'ساعتين' },
]

const time = (iso: string) => new Date(iso).toLocaleTimeString('ar-EG', { hour: 'numeric', minute: '2-digit' })

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const start = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime()
  const diff = Math.round((start(d) - start(new Date())) / 86_400_000)
  const date = d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })
  if (diff === 0) return `النهارده · ${date}`
  if (diff === 1) return `بكرة · ${date}`
  if (diff === -1) return `امبارح · ${date}`
  return date
}

/** «٢٤:٠٠» ← «١٠ م» — عرض الساعة زي ما التاجر بيقولها */
function clock(value: string): string {
  const [h, m] = value.split(':').map(Number)
  const d = new Date()
  d.setHours(h || 0, m || 0, 0, 0)
  return d.toLocaleTimeString('ar-EG', { hour: 'numeric', minute: m ? '2-digit' : undefined })
}

function hoursSummary(data: BookingsPayload): string {
  const days = WEEK.filter((d) => data.hours.days.includes(d)).map((d) => data.dayNames[d])
  const daysText = days.length === 7 ? 'كل الأيام' : days.length ? days.join('، ') : 'مفيش أيام'
  return `${daysText} · من ${clock(data.hours.from)} لـ ${clock(data.hours.to)}`
}

type Hours = { enabled: boolean; days: number[]; from: string; to: string; slotMinutes: number }

export function BookingsScreen({ visible, onUnavailable }: { visible: boolean; onUnavailable: () => void }) {
  const { data, failed, load } = useResource(bookingsData, visible, onUnavailable)
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming')
  const [statusFor, setStatusFor] = useState<Booking | null>(null)
  const [hours, setHours] = useState<Hours | null>(null)
  const [hoursError, setHoursError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const { upcoming, past } = useMemo(() => {
    const now = Date.now()
    const t = (iso: string) => new Date(iso).getTime()
    const all = [...(data?.bookings ?? [])].sort((a, b) => t(a.startsAt) - t(b.startsAt))
    return {
      upcoming: all.filter((b) => t(b.endsAt) >= now),
      /* الأقرب للنهارده الأول */
      past: all
        .filter((b) => t(b.endsAt) < now)
        .reverse()
        .slice(0, 30),
    }
  }, [data])

  const list = tab === 'upcoming' ? upcoming : past

  const setStatus = async (b: Booking, key: string, label: string) => {
    if (busy) return
    haptic('LIGHT')
    setBusy(true)
    const res = await postAppJson(`/api/app/bookings/${encodeURIComponent(b.id)}/status`, { status: key })
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      toast(res.error, { tone: 'danger' })
      return
    }
    await load()
    setBusy(false)
    hapticNotify('SUCCESS')
    toast(`الحجز بقى «${label}»`, { tone: 'success', duration: 1800 })
    setStatusFor(null)
  }

  const openHours = () => {
    if (!data) return
    haptic('LIGHT')
    setHoursError(null)
    setHours({ enabled: data.enabled, ...data.hours, days: [...data.hours.days] })
  }

  const saveHours = async (e: Event) => {
    e.preventDefault()
    if (!hours || busy) return
    setBusy(true)
    const res = await postAppJson('/api/app/bookings/hours', hours)
    if (!res.ok) {
      setBusy(false)
      hapticNotify('ERROR')
      setHoursError(res.error)
      return
    }
    await load()
    setBusy(false)
    hapticNotify('SUCCESS')
    toast('مواعيد العمل اتحفظت — بتظهر للعملاء فورًا', { tone: 'success' })
    setHours(null)
  }

  let lastDay = ''

  return (
    <Screen visible={visible} title="الحجوزات" onRefresh={load}>
      <div class="home-body">
        <header class="page-head rise">
          <div class="page-head-text">
            <h1 class="page-title">الحجوزات</h1>
            <p class="page-sub">
              {upcoming.length > 0 ? `${formatNumber(upcoming.length)} معاد جاي` : 'مواعيد عملائك ومواعيد شغلك'}
            </p>
          </div>
        </header>

        {!data ? (
          failed ? (
            <div class="empty">
              <span class="empty-icon">
                <Icon svg={icons.wifiOff()} />
              </span>
              <b>مش قادرين نجيب الحجوزات</b>
              <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
            </div>
          ) : (
            <div class="olist">
              {[0, 1, 2].map((i) => (
                <span key={i} class="sk" style="height:120px;border-radius:20px" />
              ))}
            </div>
          )
        ) : (
          <>
            <button type="button" class="card bk-hours press rise" onClick={openHours}>
              <span class={`cr-icon${data.enabled ? '' : ' cr-icon--off'}`}>
                <Icon svg={icons.clock()} />
              </span>
              <span class="cr-main">
                <b>
                  مواعيد العمل
                  <span class={`bk-state${data.enabled ? ' bk-state--on' : ''}`}>{data.enabled ? 'الحجز شغّال' : 'الحجز متوقّف'}</span>
                </b>
                <small>{hoursSummary(data)}</small>
              </span>
              <Icon svg={icons.chevronLeft()} className="ic an-chev" />
            </button>

            <div class="frail" role="tablist" aria-label="فلترة الحجوزات">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'upcoming'}
                class={`fchip${tab === 'upcoming' ? ' fchip--on' : ''}`}
                onClick={() => {
                  haptic('LIGHT')
                  setTab('upcoming')
                }}
              >
                الجاية
                <span class="fchip-n">{formatNumber(upcoming.length)}</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'past'}
                class={`fchip${tab === 'past' ? ' fchip--on' : ''}`}
                onClick={() => {
                  haptic('LIGHT')
                  setTab('past')
                }}
              >
                اللي فات
                <span class="fchip-n">{formatNumber(past.length)}</span>
              </button>
            </div>

            {list.length === 0 ? (
              <div class="empty empty--compact rise">
                <span class="empty-icon">
                  <Icon svg={CALENDAR} />
                </span>
                <b>{tab === 'upcoming' ? 'مفيش مواعيد محجوزة' : 'مفيش مواعيد فاتت'}</b>
                <p>
                  {tab === 'upcoming'
                    ? 'المواعيد بتظهر هنا أول ما عميل يحجز خدمة من متجرك. المنتج لازم يكون نوعه «خدمة».'
                    : 'المواعيد اللي عدّت هتظهر هنا.'}
                </p>
              </div>
            ) : (
              <div class="olist">
                {list.map((b, i) => {
                  const day = dayLabel(b.startsAt)
                  const header = day !== lastDay ? day : null
                  lastDay = day
                  return (
                    <div key={b.id} class="bk-item">
                      {header && <div class="bk-day">{header}</div>}
                      <article
                        class={`ocard rise${tab === 'past' ? ' bk-past' : ''}`}
                        style={{ animationDelay: `${Math.min(i, 8) * 35}ms` }}
                      >
                        <div class="ocard-top">
                          <span class="bk-time num">
                            {time(b.startsAt)} – {time(b.endsAt)}
                          </span>
                          <span class="pill" style={{ background: b.bg, color: b.fg }}>
                            {b.statusLabel}
                          </span>
                        </div>
                        <div class="ocard-name">{b.productName ?? 'خدمة'}</div>
                        <div class="ocard-meta">
                          {b.customerName ?? 'بدون اسم'}
                          {b.orderLabel ? ` · طلب ${b.orderLabel}` : ''}
                        </div>
                        {b.notes && <p class="rv-body bk-notes">{b.notes}</p>}
                        <div class="ocard-actions">
                          <button
                            type="button"
                            class="act act--wa press"
                            onClick={() => {
                              haptic('LIGHT')
                              setStatusFor(b)
                            }}
                          >
                            <Icon svg={icons.refresh()} />
                            غيّر الحالة
                          </button>
                          {b.customerPhone && (
                            <button type="button" class="act press" onClick={() => location.assign(`tel:${b.customerPhone}`)}>
                              <Icon svg={icons.phone()} />
                              اتصال
                            </button>
                          )}
                        </div>
                      </article>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>

      <Sheet open={Boolean(statusFor)} title={statusFor ? `${statusFor.customerName ?? 'الحجز'} · ${time(statusFor.startsAt)}` : ''} onClose={() => setStatusFor(null)}>
        {statusFor && data && (
          <div class="sheet-list">
            {data.statuses.map((s) => (
              <button
                key={s.key}
                type="button"
                class={`sheet-row${s.key === statusFor.status ? ' sheet-row--on' : ''}`}
                disabled={busy || s.key === statusFor.status}
                onClick={() => void setStatus(statusFor, s.key, s.label)}
              >
                <span class="dot" style={{ background: s.fg }} />
                <span class="sheet-row-label">{s.label}</span>
                {s.key === statusFor.status && <Icon svg={icons.check()} className="ic sheet-check" />}
              </button>
            ))}
          </div>
        )}
      </Sheet>

      <Sheet open={Boolean(hours)} tall title="مواعيد العمل" onClose={() => setHours(null)}>
        {hours && data && (
          <form class="np-form ops-form" onSubmit={saveHours}>
            <button
              type="button"
              class="switch-row"
              onClick={() => {
                haptic('LIGHT')
                setHours({ ...hours, enabled: !hours.enabled })
              }}
            >
              <span class="switch-text">
                <b>استقبال الحجوزات</b>
                <small>{hours.enabled ? 'العملاء يقدروا يحجزوا من متجرك' : 'تقويم الحجز مقفول في المتجر'}</small>
              </span>
              <span class={`switch${hours.enabled ? ' switch--on' : ''}`}>
                <span />
              </span>
            </button>
            <div class="np-label">
              أيام الشغل
              <div class="chips">
                {WEEK.map((d) => {
                  const on = hours.days.includes(d)
                  return (
                    <button
                      key={d}
                      type="button"
                      aria-pressed={on}
                      class={`fchip${on ? ' fchip--on' : ''}`}
                      onClick={() => {
                        haptic('LIGHT')
                        setHours({ ...hours, days: on ? hours.days.filter((x) => x !== d) : [...hours.days, d] })
                      }}
                    >
                      {data.dayNames[d]}
                    </button>
                  )
                })}
              </div>
            </div>
            <div class="np-two">
              <label class="np-label">
                من
                <input
                  class="np-input num"
                  type="time"
                  value={hours.from}
                  onInput={(e) => setHours({ ...hours, from: (e.currentTarget as HTMLInputElement).value })}
                />
              </label>
              <label class="np-label">
                لحد
                <input
                  class="np-input num"
                  type="time"
                  value={hours.to}
                  onInput={(e) => setHours({ ...hours, to: (e.currentTarget as HTMLInputElement).value })}
                />
              </label>
            </div>
            <div class="np-label">
              كل قد إيه معاد
              <div class="chips">
                {SLOTS.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    class={`fchip${hours.slotMinutes === s.value ? ' fchip--on' : ''}`}
                    onClick={() => {
                      haptic('LIGHT')
                      setHours({ ...hours, slotMinutes: s.value })
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
            {hoursError && <p class="np-error">{hoursError}</p>}
            <div class="btn-row">
              <button type="button" class="btn btn--ghost press" onClick={() => setHours(null)}>
                رجوع
              </button>
              <button type="submit" class="btn btn--primary press" disabled={busy}>
                {busy ? <span class="spinner" /> : <Icon svg={icons.check()} />}
                احفظ
              </button>
            </div>
          </form>
        )}
      </Sheet>
    </Screen>
  )
}
