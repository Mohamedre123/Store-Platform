'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import {
  ArrowDown,
  ArrowUp,
  Check,
  ImageOff,
  Loader2,
  Search,
  X,
} from 'lucide-react'
import {
  resolvePickerProducts,
  searchPickerProducts,
  type PickerCategory,
  type PickerProduct,
} from './picker-actions'
import { formatMoney } from '@/lib/utils'
import { cn } from '@/lib/utils'

/**
 * منتقي المنتجات.
 *
 * التاجر بيشوف **أقسامه ومنتجاته بصورهم** ويحدّد اللي عايزه —
 * مش بيكتب أكواد ولا بيدوّر على id. ده الفرق بين محرّر بيتستخدم
 * ومحرّر بيتقفل بعد أول محاولة.
 *
 * ## الترتيب جزء من الاختيار
 * المختار بيتعرض في قايمة تحت، والتاجر بيرتّبها. المنتج اللي عايزه
 * أول واحد لازم يقدر يحطّه أول واحد — من غير كده «اختار منتجاتك»
 * بتبقى نص الميزة.
 */
export function ProductPicker({
  open,
  value,
  categories,
  currency,
  onClose,
  onChange,
}: {
  open: boolean
  value: string[]
  categories: PickerCategory[]
  currency: string
  onClose: () => void
  onChange: (ids: string[]) => void
}) {
  const [picked, setPicked] = useState<string[]>(value)
  const [resolved, setResolved] = useState<PickerProduct[]>([])
  const [results, setResults] = useState<PickerProduct[]>([])
  const [query, setQuery] = useState('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [loading, startLoad] = useTransition()
  const searchRef = useRef<HTMLInputElement>(null)

  /* المختار بيتفتح على اللي محفوظ فعلًا — لا على آخر جلسة تحرير */
  useEffect(() => {
    if (open) setPicked(value)
  }, [open, value])

  /* أسماء وصور المختارين — عشان القايمة تحت تبان مفهومة */
  useEffect(() => {
    if (!open) return
    let alive = true
    resolvePickerProducts(picked).then((rows) => {
      if (alive) setResolved(rows)
    })
    return () => {
      alive = false
    }
  }, [open, picked])

  /*
    البحث مؤجَّل ٣٠٠ ملّي.

    من غير التأجيل كل حرف بيبعت طلبًا، والنتايج بترجع بترتيب عشوائي
    فالتاجر بيشوف نتيجة حرف قديم فوق نتيجة الحرف الجديد.
  */
  useEffect(() => {
    if (!open) return
    const id = setTimeout(() => {
      startLoad(async () => {
        setResults(await searchPickerProducts({ query, categoryId: categoryId || null }))
      })
    }, 300)
    return () => clearTimeout(id)
  }, [open, query, categoryId])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    searchRef.current?.focus()
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const pickedSet = useMemo(() => new Set(picked), [picked])

  const toggle = (id: string) =>
    setPicked((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]))

  const move = (index: number, dir: -1 | 1) =>
    setPicked((prev) => {
      const target = index + dir
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })

  if (!open) return null

  /* الأقسام الفرعية بتبان تحت أبوها بمسافة — الشجرة مستوى واحد كفاية */
  const tree = categories.filter((c) => !c.parentId)
  const options: Array<{ id: string; label: string }> = []
  for (const parent of tree) {
    options.push({ id: parent.id, label: parent.name })
    for (const child of categories.filter((c) => c.parentId === parent.id)) {
      options.push({ id: child.id, label: `‏— ${child.name}` })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="اختيار المنتجات"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] shadow-2xl sm:rounded-2xl">
        {/* رأس */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4">
          <div className="min-w-0">
            <h2 className="font-semibold">اختار منتجاتك</h2>
            <p className="text-xs text-[var(--fg-muted)]">
              {picked.length > 0 ? `${picked.length} منتج مختار` : 'دوّر بالاسم أو صفّي بالقسم'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* بحث وتصفية */}
        <div className="flex flex-col gap-2 border-b border-[var(--border)] p-4 sm:flex-row">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)] start-3"
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="اسم المنتج أو الكود"
              aria-label="بحث"
              className="h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] ps-9 pe-3 text-sm focus:border-[var(--primary)] focus:outline-none"
            />
          </div>

          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            aria-label="القسم"
            className="h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none sm:w-52"
          >
            <option value="">كل الأقسام</option>
            {options.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* النتايج */}
        <div className="min-h-40 flex-1 overflow-y-auto p-4">
          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-sm text-[var(--fg-muted)]">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              بنحمّل…
            </div>
          ) : results.length === 0 ? (
            <p className="py-12 text-center text-sm text-[var(--fg-muted)]">
              {query || categoryId ? 'مفيش منتج مطابق' : 'لسه مافيش منتجات في متجرك'}
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {results.map((p) => {
                const on = pickedSet.has(p.id)
                return (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => toggle(p.id)}
                      aria-pressed={on}
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg border p-2 text-start transition-colors',
                        on
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                          : 'border-[var(--border)] hover:bg-[var(--surface-2)]',
                      )}
                    >
                      <Thumb image={p.image} />

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{p.name}</span>
                        <span className="flex flex-wrap items-center gap-x-2 text-xs text-[var(--fg-muted)]">
                          <span className="tabular-nums">{formatMoney(p.price, currency)}</span>
                          {p.categoryName && <span className="truncate">· {p.categoryName}</span>}
                          {p.status !== 'active' && (
                            <span className="rounded bg-[var(--surface-2)] px-1 text-[var(--color-warning)]">
                              مخفي
                            </span>
                          )}
                        </span>
                      </span>

                      <span
                        className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
                          on
                            ? 'border-[var(--primary)] bg-[var(--primary)] text-[var(--primary-fg)]'
                            : 'border-[var(--border-strong)]',
                        )}
                        aria-hidden="true"
                      >
                        {on && <Check className="h-4 w-4" />}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* المختار وترتيبه */}
        {picked.length > 0 && (
          <div className="max-h-52 shrink-0 overflow-y-auto border-t border-[var(--border)] bg-[var(--surface-2)] p-4">
            <h3 className="mb-2 text-xs font-bold tracking-wide text-[var(--fg-subtle)]">
              الترتيب في المتجر
            </h3>
            <ol className="flex flex-col gap-1.5">
              {picked.map((id, i) => {
                const p = resolved.find((r) => r.id === id)
                return (
                  <li
                    key={id}
                    className="flex items-center gap-2 rounded-lg bg-[var(--surface)] p-1.5 ps-2"
                  >
                    <span className="tabular-nums w-5 shrink-0 text-xs text-[var(--fg-subtle)]">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm">
                      {p?.name ?? 'منتج اتشال'}
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      <IconBtn label="لفوق" onClick={() => move(i, -1)} disabled={i === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn
                        label="لتحت"
                        onClick={() => move(i, 1)}
                        disabled={i === picked.length - 1}
                      >
                        <ArrowDown className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn label="شيل" onClick={() => toggle(id)}>
                        <X className="h-4 w-4" />
                      </IconBtn>
                    </span>
                  </li>
                )
              })}
            </ol>
          </div>
        )}

        {/* أزرار */}
        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[var(--border)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 rounded-lg px-4 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={() => {
              onChange(picked)
              onClose()
            }}
            className="min-h-11 rounded-lg bg-[var(--primary)] px-6 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90"
          >
            تمام{picked.length > 0 ? ` (${picked.length})` : ''}
          </button>
        </div>
      </div>
    </div>
  )
}

function Thumb({ image }: { image: string | null }) {
  return (
    <span className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-[var(--surface-2)]">
      {image ? (
        <Image src={image} alt="" fill sizes="44px" className="object-cover" />
      ) : (
        <span className="flex h-full items-center justify-center text-[var(--fg-subtle)]">
          <ImageOff className="h-4 w-4" aria-hidden="true" />
        </span>
      )}
    </span>
  )
}

function IconBtn({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-8 w-8 items-center justify-center rounded-md text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)] disabled:opacity-30"
    >
      {children}
    </button>
  )
}
