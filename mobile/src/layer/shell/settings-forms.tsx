/**
 * قطع مشتركة لشاشات الإعدادات اللي بتتحفظ بزرار (الطلبات، الشيك أوت، واتساب، البريد).
 */
import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import { haptic } from '../bridge'
import { icons } from '../icons'
import { Icon } from './ui'

/** الأرقام العربي (٠١٢…) لأرقام إنجليزي — الكيبورد العربي بيكتبها كده */
export const latinDigits = (s: string) => s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))

export function Toggle({ label, hint, on, onChange }: { label: string; hint?: string; on: boolean; onChange: (next: boolean) => void }) {
  return (
    <button
      type="button"
      class="switch-row"
      aria-pressed={on}
      onClick={() => {
        haptic('LIGHT')
        onChange(!on)
      }}
    >
      <span class="switch-text">
        <b>{label}</b>
        {hint && <small>{hint}</small>}
      </span>
      <span class={`switch${on ? ' switch--on' : ''}`}>
        <span />
      </span>
    </button>
  )
}

export function Modes<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
}: {
  label: string
  hint?: string
  value: T
  options: ReadonlyArray<{ value: T; label: string }>
  onChange: (next: T) => void
}) {
  return (
    <div class="np-label">
      {label}
      <div class="chips">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            class={`fchip${value === o.value ? ' fchip--on' : ''}`}
            aria-pressed={value === o.value}
            onClick={() => {
              haptic('LIGHT')
              onChange(o.value)
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <small class="pv-hint">{hint}</small>}
    </div>
  )
}

export function Group({ title, lead, children }: { title: string; lead?: string; children: ComponentChildren }) {
  return (
    <section class="card st-group rise">
      <h2>{title}</h2>
      {lead && <p class="st-lead">{lead}</p>}
      {children}
    </section>
  )
}

/** زرار الحفظ لاصق تحت (فوق شريط التبويبات) — زي صفحة المنصة */
export function SaveBar({ busy, onSave }: { busy: boolean; onSave: () => void }) {
  return (
    <div class="np-save">
      <button type="button" class="btn btn--primary btn--lg press st-save" disabled={busy} onClick={onSave}>
        {busy ? <span class="spinner" /> : <Icon svg={icons.check()} />}
        احفظ التعديلات
      </button>
    </div>
  )
}

export function LoadState({ failed, what }: { failed: boolean; what: string }) {
  return failed ? (
    <div class="empty">
      <span class="empty-icon">
        <Icon svg={icons.wifiOff()} />
      </span>
      <b>مش قادرين نجيب {what}</b>
      <p>اتأكد من النت واسحب لتحت عشان تحاول تاني.</p>
    </div>
  ) : (
    <div class="olist">
      {[0, 1, 2].map((i) => (
        <span key={i} class="sk" style="height:150px;border-radius:20px" />
      ))}
    </div>
  )
}

/**
 * فورم بيتعبّى من بيانات الخادم — وبيتحدّث معاها طول ما التاجر ما غيّرش حاجة.
 * بعد الحفظ `saved()` قبل إعادة التحميل عشان الفورم ياخد القيم الجديدة.
 */
export function useSyncedForm<S, F>(source: S | null, map: (s: S) => F) {
  const [form, setForm] = useState<F | null>(() => (source ? map(source) : null))
  const dirty = useRef(false)

  useEffect(() => {
    if (source && !dirty.current) setForm(map(source))
  }, [source])

  const patch = (p: Partial<F>) => {
    dirty.current = true
    setForm((f) => (f ? { ...f, ...p } : f))
  }
  const saved = () => {
    dirty.current = false
  }
  return { form, patch, saved }
}
