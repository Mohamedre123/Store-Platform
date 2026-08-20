'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, Sparkles, X } from 'lucide-react'
import { improveTextAction } from '@/app/dashboard/ai-actions'
import type { TaskKey } from '@/lib/ai/tasks'

/**
 * زرار «تحسين».
 *
 * قطعة واحدة بتتحط جنب أي حقل نص في المنصة. أي حقل جديد بيتحسّن
 * بسطر واحد بدل ما كل صفحة تكتب نسخة.
 *
 * تلات قرارات:
 *
 * ١. **بيقترح ما بيستبدلش.** الاستبدال المباشر بيخلّي التاجر يقبل
 *    أول حاجة تيجي من غير ما يقراها. الاختيار من تلاتة بيخلّيه يقارن.
 * ٢. **خانة توجيه اختيارية.** «خلّيه أقصر» أو «ركّز على الخامة» —
 *    من غيرها التاجر اللي مش عاجبه الرد مالوش غير إنه يعيد ويعيد.
 * ٣. **لو الإضافة مش متظبّطة، بيودّيه لصفحة الإضافات** بدل ما يقوله
 *    «فشل» ويسيبه يدوّر.
 */
export function ImproveButton({
  task,
  value,
  onApply,
  fields,
  label = 'تحسين',
  compact,
}: {
  task: TaskKey
  /** النص الحالي — بيتبعت كأساس للتحسين */
  value: string
  onApply: (next: string) => void
  /** بيانات المنتج — بتفرق جدًا في جودة الناتج */
  fields?: Record<string, string | null | undefined>
  label?: string
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [needsSetup, setNeedsSetup] = useState(false)
  const [hint, setHint] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  // القفل بالضغط برّه أو بـEscape — زي أي قائمة منسدلة في اللوحة
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const run = () =>
    start(async () => {
      setError(null)
      setNeedsSetup(false)
      const res = await improveTextAction({
        task,
        current: value,
        fields: Object.fromEntries(
          Object.entries(fields ?? {})
            .filter(([, v]) => v)
            .map(([k, v]) => [k, String(v)]),
        ),
        hint: hint || undefined,
      })

      if (res.ok) {
        setSuggestions(res.suggestions)
      } else {
        setError(res.error)
        setNeedsSetup(Boolean(res.needsSetup))
        setSuggestions([])
      }
    })

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => {
          const next = !open
          setOpen(next)
          if (next && suggestions.length === 0 && !error) run()
        }}
        disabled={pending}
        className={`flex items-center gap-1.5 rounded-lg border border-[var(--primary)]/35 bg-[var(--primary-soft)] font-medium text-[var(--primary)] transition-opacity hover:opacity-80 disabled:opacity-60 ${
          compact ? 'min-h-8 px-2 text-xs' : 'min-h-9 px-3 text-sm'
        }`}
      >
        <Sparkles
          className={`${compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} ${pending ? 'animate-pulse' : ''}`}
          aria-hidden="true"
        />
        {pending ? 'بيفكّر…' : label}
      </button>

      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="اقتراحات التحسين"
          /*
            العرض ثابت على الديسكتوب ومحسوب من الشاشة على الموبايل:
            لوحة بعرض ٢٢rem على شاشة ٣٧٥px بتخرج برّه وتعمل تمرير أفقي.
          */
          className="absolute z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-xl end-0"
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">اقتراحات</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="إغلاق"
              className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {error && (
            <div className="mb-2 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-xs text-[var(--color-danger)]">
              {error}
              {needsSetup && (
                <Link
                  href="/dashboard/plugins"
                  className="mt-1 block font-semibold underline"
                >
                  افتح الإضافات وظبّطها
                </Link>
              )}
            </div>
          )}

          {pending && suggestions.length === 0 && !error && (
            <div className="flex flex-col gap-2 py-1">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="h-9 animate-pulse rounded-lg bg-[var(--surface-2)]"
                  style={{ animationDelay: `${i * 120}ms` }}
                />
              ))}
            </div>
          )}

          {suggestions.length > 0 && (
            <ul className="flex flex-col gap-1.5">
              {suggestions.map((s, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => {
                      onApply(s)
                      setOpen(false)
                    }}
                    className="group flex w-full items-start gap-2 rounded-lg border border-[var(--border)] p-2.5 text-start text-sm transition-colors hover:border-[var(--primary)] hover:bg-[var(--primary-soft)]"
                  >
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--fg-subtle)] transition-colors group-hover:text-[var(--primary)]"
                      aria-hidden="true"
                    />
                    <span className="flex-1 leading-relaxed">{s}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-2 flex gap-1.5 border-t border-[var(--border)] pt-2">
            <input
              value={hint}
              onChange={(e) => setHint(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  run()
                }
              }}
              placeholder="خلّيه أقصر… ركّز على الخامة…"
              className="min-h-9 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 text-xs focus:border-[var(--primary)] focus:outline-none"
            />
            <button
              type="button"
              onClick={run}
              disabled={pending}
              className="min-h-9 shrink-0 rounded-lg bg-[var(--primary)] px-3 text-xs font-medium text-[var(--primary-fg)] disabled:opacity-60"
            >
              جرّب تاني
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
