import * as React from 'react'
import { cn } from '@/lib/utils'

/* ────────────────────────── زر ────────────────────────── */

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
}

const buttonVariants = {
  primary:
    'bg-[var(--primary)] text-[var(--primary-fg)] hover:opacity-90 shadow-sm disabled:opacity-50',
  secondary:
    'bg-[var(--surface)] text-[var(--fg)] border border-[var(--border-strong)] hover:bg-[var(--surface-2)] disabled:opacity-50',
  ghost: 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)] disabled:opacity-50',
  danger: 'bg-[var(--color-danger)] text-white hover:opacity-90 disabled:opacity-50',
}

const buttonSizes = {
  // الارتفاع لا يقل عن 44px على الموبايل — مساحة لمس مريحة
  sm: 'h-9 px-3 text-sm rounded-lg',
  md: 'h-11 px-4 text-sm rounded-lg',
  lg: 'h-12 px-6 text-base rounded-xl',
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex select-none items-center justify-center gap-2 font-semibold transition-all',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]',
        'disabled:cursor-not-allowed',
        buttonVariants[variant],
        buttonSizes[size],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn('animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-90"
        fill="currentColor"
        d="M4 12a8 8 0 0 1 8-8v3a5 5 0 0 0-5 5H4z"
      />
    </svg>
  )
}

/* ────────────────────────── حقل ────────────────────────── */

type FieldProps = {
  label: string
  hint?: string
  error?: string
  required?: boolean
  children: React.ReactNode
  htmlFor?: string
}

export function Field({ label, hint, error, required, children, htmlFor }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-[var(--fg)]">
        {label}
        {required && (
          <span className="ms-1 text-[var(--color-danger)]" aria-hidden="true">
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p className="text-xs text-[var(--color-danger)]" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-[var(--fg-subtle)]">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          'h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3',
          'text-base placeholder:text-[var(--fg-subtle)]',
          // 16px على الموبايل يمنع iOS من تكبير الصفحة عند التركيز
          'sm:text-sm',
          'transition-colors focus:border-[var(--primary)] focus:outline-none',
          'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
          'disabled:cursor-not-allowed disabled:opacity-60',
          className,
        )}
        {...props}
      />
    )
  },
)

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(
        'w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5',
        'text-base leading-relaxed placeholder:text-[var(--fg-subtle)] sm:text-sm',
        'transition-colors focus:border-[var(--primary)] focus:outline-none',
        'focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--ring)]',
        className,
      )}
      {...props}
    />
  )
})

/* ────────────────────────── تنبيه ────────────────────────── */

export function Alert({
  tone = 'danger',
  children,
}: {
  tone?: 'danger' | 'success' | 'warning' | 'info'
  children: React.ReactNode
}) {
  const tones = {
    danger: 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]',
    success: 'bg-[var(--color-success-soft)] text-[var(--color-success)]',
    warning: 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]',
    info: 'bg-[var(--color-info-soft)] text-[var(--color-info)]',
  }
  return (
    <div className={cn('rounded-lg px-3.5 py-2.5 text-sm', tones[tone])} role="alert">
      {children}
    </div>
  )
}

/* ────────────────────────── بطاقة ────────────────────────── */

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]',
        className,
      )}
    >
      {children}
    </div>
  )
}
