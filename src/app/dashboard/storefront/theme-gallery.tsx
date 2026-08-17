'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Sparkles } from 'lucide-react'
import { applyThemeAction } from './actions'
import { THEMES, THEME_CATEGORIES, type ThemeCategory } from '@/lib/themes'
import { Button } from '@/components/ui'
import { Reveal, SpotlightCard } from '@/components/motion'
import { cn } from '@/lib/utils'

/**
 * معاينة مصغّرة للثيم مرسومة بالـCSS.
 *
 * مش صورة جاهزة عمدًا: لو الثيم اتعدّل، المعاينة بتتعدّل معاه فورًا،
 * وما بنحتاجش نرفع لقطة شاشة جديدة لكل ثيم في كل مرة.
 */
function ThemePreview({ theme }: { theme: (typeof THEMES)[number] }) {
  const { palette, radius, headerStyle } = theme
  const r = { none: '0', sm: '3px', md: '7px', lg: '11px', full: '999px' }[radius]

  return (
    <div
      className="pointer-events-none aspect-[4/3] w-full overflow-hidden border-b border-[var(--border)]"
      style={{ background: palette.background }}
      aria-hidden="true"
    >
      {/* الهيدر */}
      <div
        className={cn(
          'flex h-6 items-center gap-1.5 px-2.5',
          headerStyle === 'centered' && 'justify-center',
          headerStyle === 'split' && 'justify-between',
        )}
        style={{ background: palette.surface, borderBottom: `1px solid ${palette.text}14` }}
      >
        <div className="h-1.5 w-6 rounded-full" style={{ background: palette.primary }} />
        {headerStyle !== 'centered' && (
          <div className="flex gap-1">
            {[8, 6, 7].map((w, i) => (
              <div key={i} className="h-1 rounded-full" style={{ width: w, background: `${palette.text}33` }} />
            ))}
          </div>
        )}
      </div>

      {/* البانر */}
      <div
        className="mx-2.5 mt-2.5 flex h-11 flex-col justify-center gap-1 px-2.5"
        style={{ background: palette.primary, borderRadius: r }}
      >
        <div className="h-1.5 w-1/2 rounded-full" style={{ background: '#ffffff99' }} />
        <div className="h-1 w-1/3 rounded-full" style={{ background: '#ffffff66' }} />
      </div>

      {/* شبكة المنتجات */}
      <div className="mt-2.5 grid grid-cols-4 gap-1.5 px-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1">
            <div className="aspect-square" style={{ background: `${palette.text}12`, borderRadius: r }} />
            <div className="h-1 w-3/4 rounded-full" style={{ background: `${palette.text}25` }} />
            <div className="h-1 w-1/2 rounded-full" style={{ background: palette.accent }} />
          </div>
        ))}
      </div>
    </div>
  )
}

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
