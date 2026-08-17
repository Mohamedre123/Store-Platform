'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { applyThemeAction } from './actions'
import { THEMES, THEME_CATEGORIES, type ThemeCategory } from '@/lib/themes'
import { ThemePreview } from './theme-preview'
import { Button } from '@/components/ui'
import { Reveal, SpotlightCard } from '@/components/motion'
import { cn } from '@/lib/utils'

export function ThemeGallery({ currentSlug }: { currentSlug: string }) {
  const [filter, setFilter] = useState<ThemeCategory | 'الكل'>('الكل')
  const [applying, setApplying] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const shown = filter === 'الكل' ? THEMES : THEMES.filter((t) => t.categories.includes(filter))

  function apply(slug: string) {
    setApplying(slug)
    startTransition(async () => {
      await applyThemeAction(slug)
      setApplying(null)
    })
  }

  return (
    <div className="flex flex-col gap-5">
      {/* تصنيفات */}
      <div className="scroll-x -mx-1 flex gap-2 px-1 pb-1">
        {(['الكل', ...THEME_CATEGORIES] as const).map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setFilter(c)}
            className={cn(
              'shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              filter === c
                ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((theme, i) => {
          const active = theme.slug === currentSlug
          return (
            <Reveal key={theme.slug} delay={(i % 3) * 70}>
              <SpotlightCard
                className={cn(
                  'flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border bg-[var(--surface)]',
                  active ? 'border-[var(--primary)] ring-1 ring-[var(--primary)]' : 'border-[var(--border)]',
                )}
              >
                <ThemePreview theme={theme} />

                <div className="flex flex-1 flex-col gap-2.5 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-semibold">{theme.name}</h3>
                      <p dir="ltr" className="text-start text-xs text-[var(--fg-subtle)]">
                        {theme.nameEn}
                      </p>
                    </div>
                    {active ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--color-success-soft)] px-2 py-1 text-xs font-medium text-[var(--color-success)]">
                        <Check className="h-3 w-3" aria-hidden="true" />
                        مفعّل
                      </span>
                    ) : theme.isPro ? (
                      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[var(--primary-soft)] px-2 py-1 text-xs font-medium text-[var(--primary)]">
                        <Sparkles className="h-3 w-3" aria-hidden="true" />
                        مميّز
                      </span>
                    ) : null}
                  </div>

                  <p className="flex-1 text-sm leading-relaxed text-[var(--fg-muted)]">
                    {theme.description}
                  </p>

                  <p className="text-xs text-[var(--fg-subtle)]">
                    مناسب لـ: {theme.bestFor}
                  </p>

                  <ul className="flex flex-wrap gap-1.5">
                    {theme.traits.map((t) => (
                      <li
                        key={t}
                        className="rounded-md bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--fg-muted)]"
                      >
                        {t}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-1 flex items-center gap-2">
                    <span className="flex gap-1" aria-hidden="true">
                      {[theme.palette.primary, theme.palette.accent, theme.palette.background].map((c) => (
                        <span
                          key={c}
                          className="h-4 w-4 rounded-full border border-[var(--border)]"
                          style={{ background: c }}
                        />
                      ))}
                    </span>

                    <Button
                      size="sm"
                      variant={active ? 'secondary' : 'primary'}
                      disabled={active || applying !== null}
                      onClick={() => apply(theme.slug)}
                      className="ms-auto"
                    >
                      {applying === theme.slug && <Loader2 className="h-4 w-4 animate-spin" />}
                      {active ? 'الحالي' : 'تطبيق'}
                    </Button>
                  </div>
                </div>
              </SpotlightCard>
            </Reveal>
          )
        })}
      </div>
    </div>
  )
}
