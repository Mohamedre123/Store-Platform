'use client'

import { Check, ExternalLink, Loader2, TriangleAlert, X } from 'lucide-react'
import { providerLabel, type AiIssue } from '@/lib/ai/providers-meta'

/** نتيجة «تحقّق» لمفتاح بعينه */
export type KeyCheck = { tone: 'success' | 'warning' | 'danger'; text: string } | null | undefined

/**
 * قطع مشتركة لكروت إضافات الذكاء.
 *
 * التلات كروت (الرد على العملاء، والمساعد، والمصمّم) بقوا يقبلوا أكتر
 * من مفتاح. لو كل كارت رسم خانة المفتاح ومبدّل المزوّد بطريقته، التاجر
 * بيتعلّم تلات أشكال لنفس الحاجة — وأول تعديل بيتعمل في واحد وينسى
 * الباقي.
 */

type Model = { id: string; label: string }

/**
 * خانة مفتاح مع زرار تحقّق.
 *
 * **التحقّق بنداء حقيقي لا بشكل المفتاح.** صيغ المفاتيح بتتغيّر عند
 * المزوّدين، وأي فحص بالشكل بيرفض مفاتيح سليمة والتاجر يفضل يحاول
 * ومش فاهم.
 */
export function KeyField({
  id,
  label,
  value,
  onChange,
  saved,
  placeholder,
  docHref,
  busy,
  onVerify,
  onRemove,
  optional,
  result,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  saved: boolean
  placeholder: string
  docHref: string
  busy: boolean
  onVerify: () => void
  /** مسح المفتاح المحفوظ — الفاضي معناه «سيبه»، فالمسح لازم يبقى زرار */
  onRemove?: () => void
  optional?: boolean
  /**
   * نتيجة «تحقّق» — بتظهر تحت الخانة نفسها.
   *
   * كانت بتظهر فوق أول الكارت، والخانة تحت في نص نافذة بتتمرّر —
   * فالتاجر بيدوس تحقّق وما يشوفش أي حاجة، ويفتكر الزرار مش شغّال.
   */
  result?: KeyCheck
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
          {optional && <span className="font-normal text-[var(--fg-subtle)]"> (اختياري)</span>}
        </label>
        {saved && (
          <span className="rounded-md bg-[var(--color-success-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-success)]">
            محفوظ
          </span>
        )}
        {saved && onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="ms-auto text-xs text-[var(--color-danger)] hover:underline"
          >
            امسح المفتاح
          </button>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          type="password"
          autoComplete="off"
          dir="ltr"
          placeholder={saved ? '•••••••••• (محفوظ)' : placeholder}
          className="min-h-11 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start font-mono text-sm focus:border-[var(--primary)] focus:outline-none"
        />
        <button
          type="button"
          onClick={onVerify}
          disabled={busy || !value.trim()}
          className="min-h-11 shrink-0 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium transition-colors hover:bg-[var(--surface-2)] disabled:opacity-50"
        >
          {busy ? 'بيتأكّد…' : 'تحقّق'}
        </button>
      </div>

      <div role="status" aria-live="polite">
        {busy ? (
          <p className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]">
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
            بنجرّب المفتاح بنداء حقيقي — ممكن ياخد لحد ٢٠ ثانية.
          </p>
        ) : result ? (
          <p
            className={`flex items-start gap-1.5 rounded-lg px-3 py-2 text-xs leading-relaxed ${
              result.tone === 'success'
                ? 'bg-[var(--color-success-soft)] text-[var(--color-success)]'
                : result.tone === 'warning'
                  ? 'bg-[var(--color-warning-soft)] text-[var(--color-warning)]'
                  : 'bg-[var(--color-danger-soft)] text-[var(--color-danger)]'
            }`}
          >
            {result.tone === 'success' ? (
              <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : result.tone === 'warning' ? (
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            ) : (
              <X className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0">{result.text}</span>
          </p>
        ) : null}
      </div>

      <a
        href={docHref}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-[var(--primary)] hover:underline"
      >
        اجيب المفتاح منين؟
        <ExternalLink className="h-3 w-3" aria-hidden="true" />
      </a>
    </div>
  )
}

/**
 * مبدّل المزوّد — أزرار جنب بعض لا قايمة.
 *
 * اختيارين أو تلاتة بيبانوا كلهم مرة واحدة، والقايمة المنسدلة بتخبّي
 * إن فيه اختيار تاني أصلًا.
 */
export function ProviderSwitch<T extends string>({
  label,
  hint,
  options,
  value,
  onChange,
}: {
  label: string
  hint?: string
  options: Array<{ key: T; label: string; disabled?: boolean }>
  value: T | null
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            role="radio"
            aria-checked={value === o.key}
            disabled={o.disabled}
            onClick={() => onChange(o.key)}
            className={`min-h-11 min-w-24 flex-1 rounded-lg px-3 text-sm font-medium transition-colors disabled:opacity-40 ${
              value === o.key
                ? 'bg-[var(--primary)] text-[var(--primary-fg)]'
                : 'bg-[var(--surface-2)] text-[var(--fg-muted)] hover:bg-[var(--border)]'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      {hint && <span className="text-xs text-[var(--fg-subtle)]">{hint}</span>}
    </div>
  )
}

export function ModelSelect({
  label,
  value,
  onChange,
  models,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  models: Model[]
  hint?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
      >
        {!models.some((m) => m.id === value) && value && <option value={value}>{value}</option>}
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      {hint && <span className="text-xs text-[var(--fg-subtle)]">{hint}</span>}
    </label>
  )
}

/** «من ٣ ساعات» — التاجر محتاج يعرف المشكلة لسه قايمة ولا قديمة */
function ago(iso: string): string {
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return ''
  const minutes = Math.max(1, Math.round((Date.now() - t) / 60_000))
  if (minutes < 60) return `من ${minutes} دقيقة`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `من ${hours} ساعة`
  return `من ${Math.round(hours / 24)} يوم`
}

/**
 * آخر مشكلة حساب — رصيد أو مفتاح.
 *
 * البوت بيحوّل العميل لواتساب لما الرصيد يخلص، والتاجر ما بيعرفش إن
 * بوته واقف. الكارت هو أول مكان بيبص فيه، فالمشكلة بتتكتب هنا بجملتها
 * ومكان الشحن. وبتختفي لوحدها أول ما نداء ينجح أو التاجر يحفظ.
 */
export function IssueBanner({ issue }: { issue: AiIssue | null | undefined }) {
  if (!issue) return null
  return (
    <div className="flex items-start gap-2 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2.5 text-xs leading-relaxed text-[var(--color-danger)]">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="min-w-0">
        <strong className="font-semibold">
          {providerLabel(issue.provider)} وقف {ago(issue.at)}:
        </strong>{' '}
        {issue.message}
      </span>
    </div>
  )
}
