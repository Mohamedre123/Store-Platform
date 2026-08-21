'use client'

import { useId, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * عناصر التحكّم في محرّر الثيم.
 *
 * كلها بنفس الشكل: عنوان صغير، ثم العنصر، ثم شرح اختياري تحته.
 * الاتساق هنا مش تجميل — المحرّر فيه عشرات الخيارات، ولو كل واحد
 * شكله مختلف بيبقى مرهق للقراءة.
 */

export function Row({
  label,
  hint,
  children,
  stacked = false,
}: {
  label: string
  hint?: string
  children: ReactNode
  stacked?: boolean
}) {
  return (
    <div className={cn('flex gap-2', stacked ? 'flex-col' : 'flex-col')}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
      </div>
      {children}
      {hint && <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">{hint}</p>}
    </div>
  )
}

/* ────────────────────────── مفتاح تشغيل ────────────────────────── */

export function Toggle({
  label,
  hint,
  checked,
  onChange,
  srLabel,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
  /**
   * اسم للقارئ الصوتي لما العنوان الظاهر يبقى فاضي.
   *
   * بيحصل لما الكارت نفسه فيه العنوان والشرح والمفتاح جنبه — من
   * غيره المفتاح بيوصل لمستخدم القارئ الصوتي بلا اسم خالص.
   */
  srLabel?: string
}) {
  const id = useId()
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        {label && <span className="block text-sm font-medium">{label}</span>}
        {hint && <span className="mt-0.5 block text-xs leading-relaxed text-[var(--fg-subtle)]">{hint}</span>}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={srLabel || label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors',
          checked ? 'bg-[var(--primary)]' : 'bg-[var(--border-strong)]',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
            // في RTL المقبض يبدأ من اليمين
            checked ? 'start-0.5' : 'start-[1.375rem]',
          )}
        />
      </button>
    </div>
  )
}

/* ────────────────────────── اختيار من مجموعة ────────────────────────── */

export function Choice<T extends string | number>({
  label,
  hint,
  value,
  options,
  onChange,
  columns = 3,
}: {
  label: string
  hint?: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (v: T) => void
  columns?: 2 | 3 | 4 | 5
}) {
  return (
    <Row label={label} hint={hint}>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            aria-pressed={value === o.value}
            className={cn(
              'min-h-10 rounded-lg border px-2 text-xs font-medium transition-colors',
              value === o.value
                ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </Row>
  )
}

/* ────────────────────────── لون ────────────────────────── */

const SWATCHES = [
  '#634b9a', '#1b1b1f', '#0f4c81', '#15803d', '#b3341f',
  '#a8577a', '#6b5644', '#c9a227', '#0d9488', '#ffffff',
]

export function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
}) {
  const id = useId()
  return (
    <Row label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <label
          htmlFor={id}
          className="h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-lg border border-[var(--border-strong)]"
          style={{ background: value }}
        >
          <input
            id={id}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-full w-full cursor-pointer opacity-0"
            aria-label={label}
          />
        </label>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          dir="ltr"
          spellCheck={false}
          className="h-10 w-28 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 text-start font-mono text-xs focus:border-[var(--primary)] focus:outline-none"
        />
        <div className="flex flex-wrap gap-1">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => onChange(c)}
              aria-label={`اللون ${c}`}
              className={cn(
                'h-6 w-6 rounded-md border transition-transform hover:scale-110',
                value.toLowerCase() === c ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]' : 'border-[var(--border)]',
              )}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>
    </Row>
  )
}

/* ────────────────────────── نص ورقم ────────────────────────── */

export function TextField({
  label,
  hint,
  value,
  onChange,
  placeholder,
  ltr = false,
  multiline = false,
}: {
  label: string
  hint?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  ltr?: boolean
  multiline?: boolean
}) {
  const shared =
    'w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm transition-colors focus:border-[var(--primary)] focus:outline-none'

  return (
    <Row label={label} hint={hint}>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          dir={ltr ? 'ltr' : undefined}
          className={cn(shared, 'py-2.5 leading-relaxed', ltr && 'text-start')}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          dir={ltr ? 'ltr' : undefined}
          className={cn(shared, 'h-10', ltr && 'text-start')}
        />
      )}
    </Row>
  )
}

export function NumberField({
  label,
  hint,
  value,
  onChange,
  min,
  max,
  suffix,
}: {
  label: string
  hint?: string
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  suffix?: string
}) {
  return (
    <Row label={label} hint={hint}>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(Number(e.target.value))}
          dir="ltr"
          className="h-10 w-28 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm tabular-nums focus:border-[var(--primary)] focus:outline-none"
        />
        {suffix && <span className="text-xs text-[var(--fg-subtle)]">{suffix}</span>}
      </div>
    </Row>
  )
}

/* ────────────────────────── عنوان مجموعة ────────────────────────── */

export function Group({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-b border-[var(--border)] pb-6 last:border-0 last:pb-0">
      {title && <h3 className="text-xs font-bold tracking-wide text-[var(--fg-subtle)]">{title}</h3>}
      {children}
    </section>
  )
}
