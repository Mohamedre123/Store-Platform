'use client'

import { useState, useTransition } from 'react'
import { ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Lock, Monitor, Save, Smartphone } from 'lucide-react'
import { saveSectionsAction } from './actions'
import { getSectionMeta, IMAGE_SPECS, SECTION_LIBRARY } from '@/lib/themes'
import type { Section } from '@/db/schema'
import { Alert, Button } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * بطاقة تشرح مقاس صورة مطلوب.
 *
 * التاجر بيرفع صورة بمقاس عشوائي فتطلع مقصوصة، وميعرفش السبب.
 * فبنقوله المقاس بالبكسل والنسبة والغرض — قبل ما يرفع لا بعد ما يشتكي.
 */
export function ImageSpecHint({ specKey }: { specKey: keyof typeof IMAGE_SPECS }) {
  const spec = IMAGE_SPECS[specKey]
  const isPortrait = spec.height > spec.width
  const Icon = isPortrait ? Smartphone : Monitor

  const ratio = (() => {
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
    const g = gcd(spec.width, spec.height)
    return `${spec.width / g}:${spec.height / g}`
  })()

  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold">{spec.label}</span>
          <span dir="ltr" className="num text-xs font-medium text-[var(--primary)]">
            {spec.width} × {spec.height} px
          </span>
          <span dir="ltr" className="num text-xs text-[var(--fg-subtle)]">
            ({ratio})
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">{spec.note}</p>
      </div>
    </div>
  )
}

export function SectionEditor({ initial }: { initial: Section[] }) {
  // أي قسم في المكتبة مش موجود عند المتجر يتضاف مطفيًا
  const merged: Section[] = [
    ...initial,
    ...SECTION_LIBRARY.filter((lib) => !initial.some((s) => s.type === lib.type)).map((lib) => ({
      id: lib.type,
      type: lib.type,
      enabled: false,
      settings: {},
    })),
  ]

  const [sections, setSections] = useState<Section[]>(merged)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  function move(index: number, direction: -1 | 1) {
    const target = index + direction
    if (target < 0 || target >= sections.length) return
    if (getSectionMeta(sections[index].type).locked) return
    if (getSectionMeta(sections[target].type).locked) return

    setSections((prev) => {
      const next = [...prev]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
    setDirty(true)
    setSaved(false)
  }

  function toggle(index: number) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, enabled: !s.enabled } : s)))
    setDirty(true)
    setSaved(false)
  }

  function save() {
    startTransition(async () => {
      await saveSectionsAction(sections)
      setDirty(false)
      setSaved(true)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {saved && <Alert tone="success">اتحفظ. افتح متجرك عشان تشوف الترتيب الجديد.</Alert>}

      <ul className="surface divide-y divide-[var(--border)] overflow-hidden">
        {sections.map((section, i) => {
          const meta = getSectionMeta(section.type)
          return (
            <li
              key={section.id || section.type}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors',
                !section.enabled && 'bg-[var(--surface-2)]',
              )}
            >
              <span className="shrink-0 text-[var(--fg-subtle)]" aria-hidden="true">
                {meta.locked ? <Lock className="h-4 w-4" /> : <GripVertical className="h-4 w-4" />}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn('text-sm font-medium', !section.enabled && 'text-[var(--fg-subtle)]')}>
                    {meta.name}
                  </span>
                  {meta.locked && (
                    <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--fg-subtle)]">
                      ثابت في الأول
                    </span>
                  )}
                  {!section.enabled && (
                    <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--fg-subtle)]">
                      مخفي
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-[var(--fg-muted)]">{meta.description}</p>
              </div>

              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => toggle(i)}
                  aria-label={section.enabled ? `إخفاء ${meta.name}` : `إظهار ${meta.name}`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
                >
                  {section.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  disabled={i === 0 || meta.locked}
                  aria-label={`تحريك ${meta.name} لفوق`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)] disabled:opacity-30"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  disabled={i === sections.length - 1 || meta.locked}
                  aria-label={`تحريك ${meta.name} لتحت`}
                  className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)] disabled:opacity-30"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
              </div>
            </li>
          )
        })}
      </ul>

      <div className="flex items-center gap-3">
        <Button onClick={save} loading={pending} disabled={!dirty}>
          <Save className="h-4 w-4" aria-hidden="true" />
          حفظ الترتيب
        </Button>
        {dirty && <span className="text-sm text-[var(--color-warning)]">فيه تعديلات مش محفوظة</span>}
      </div>
    </div>
  )
}
