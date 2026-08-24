'use client'

import { useMemo, useState, useTransition } from 'react'
import {
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  Copy,
  Eye,
  EyeOff,
  GalleryHorizontal,
  Grid3x3,
  Image as ImageIcon,
  Images,
  LayoutGrid,
  Lock,
  Mail,
  Megaphone,
  PanelsTopLeft,
  Percent,
  Play,
  Plus,
  Quote,
  Save,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Square,
  Star,
  Store,
  Timer,
  Trash2,
  Type,
  CircleHelp,
  X,
  type LucideIcon,
} from 'lucide-react'
import { saveSectionsAction } from './actions'
import { BlockSettings } from './block-settings'
import type { PickerCategory } from './picker-actions'
import { BLOCK_LIBRARY, blockMeta, defaultSettings, renderType, type BlockType } from '@/lib/blocks'
import type { Section } from '@/db/schema'
import { Alert, Button } from '@/components/ui'
import { cn } from '@/lib/utils'

/**
 * بنّاء الصفحة الرئيسية.
 *
 * الفرق عن اللي كان: القايمة مكانتش قابلة للزيادة. عشر أقسام ثابتة،
 * كل واحد شغّال أو مقفول، وخلاص. التاجر اللي عايز قسمين منتجات —
 * واحد للجديد وواحد لقسم معيّن — مكانش قدامه غير إنه يختار واحد.
 *
 * هنا كل بلوك **نسخة** ليها إعداداتها. يضيف ويكرّر ويحذف ويرتّب،
 * ويفتح أي واحد يظبّطه من غير ما يسيب الصفحة.
 *
 * ## الحفظ صريح
 * التعديل بيفضل محلّي لحد ما التاجر يضغط حفظ. الحفظ التلقائي مع كل
 * حرف كان معناه إن المتجر بيتغيّر تحت رجل العميل وهو بيتفرّج — ولو
 * التاجر غيّر رأيه مفيش رجوع.
 */

const ICONS: Record<string, LucideIcon> = {
  image: ImageIcon,
  'shopping-bag': ShoppingBag,
  'layout-grid': LayoutGrid,
  'panels-top-left': PanelsTopLeft,
  'gallery-horizontal': GalleryHorizontal,
  timer: Timer,
  type: Type,
  play: Play,
  images: Images,
  'circle-help': CircleHelp,
  'badge-check': BadgeCheck,
  quote: Quote,
  store: Store,
  mail: Mail,
  star: Star,
  sparkles: Sparkles,
  percent: Percent,
  'grid-3x3': Grid3x3,
  megaphone: Megaphone,
  'shield-check': ShieldCheck,
  square: Square,
}

const iconFor = (key: string) => ICONS[key] ?? Square

export function PageBuilder({
  initial,
  categories,
  currency,
}: {
  initial: Section[]
  categories: PickerCategory[]
  currency: string
}) {
  const [sections, setSections] = useState<Section[]>(initial)
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saved, setSaved] = useState(false)
  const [pending, startTransition] = useTransition()

  const touch = (next: Section[]) => {
    setSections(next)
    setDirty(true)
    setSaved(false)
  }

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= sections.length) return
    /* البانر الرئيسي ثابت فوق — هو أول حاجة العميل بيشوفها */
    if (blockMeta(sections[index].type).locked || blockMeta(sections[target].type).locked) return

    const next = [...sections]
    ;[next[index], next[target]] = [next[target], next[index]]
    touch(next)
  }

  const patch = (id: string, settings: Record<string, unknown>) =>
    touch(sections.map((s) => (s.id === id ? { ...s, settings } : s)))

  const add = (type: BlockType) => {
    /*
      المعرّف بالطابع الزمني لا بالطول: التاجر اللي حذف بلوكًا وضاف
      واحدًا كان بياخد نفس المعرّف، وReact بيعيد استعمال حالة القديم
      فالإعدادات القديمة بتفضل ظاهرة في الجديد.
    */
    const id = `${type}-${Date.now().toString(36)}`
    touch([...sections, { id, type, enabled: true, settings: defaultSettings(type) }])
    setOpenId(id)
    setAdding(false)
  }

  const duplicate = (section: Section) => {
    const id = `${section.type}-${Date.now().toString(36)}`
    const index = sections.findIndex((s) => s.id === section.id)
    const next = [...sections]
    next.splice(index + 1, 0, { ...section, id, settings: { ...section.settings } })
    touch(next)
    setOpenId(id)
  }

  const save = () =>
    startTransition(async () => {
      await saveSectionsAction(sections)
      setDirty(false)
      setSaved(true)
    })

  /**
   * قايمة الإضافة بتعرض **اللي مش موجود بس**.
   *
   * البلوك اللي على الصفحة خلاص — حتى لو مخفي — مالوش لزوم يتعرض
   * تاني: التاجر بيدوس عليه فيلاقي نسخة تانية ظهرت ومش فاهم منين،
   * أو يفتكر إن اللي عنده اتبدّل.
   *
   * والنسخة التانية من نفس النوع لسه ممكنة، بس من زر **التكرار** على
   * البلوك نفسه — وهو أحسن أصلًا لأنه بينسخ الإعدادات معاه بدل ما
   * يبدأ من فاضي.
   *
   * والأنواع القديمة بتتحسب بنوعها المعروض: متجر عنده «وصل حديثًا»
   * القديم عنده بلوك منتجات فعلًا، فما ينفعش نعرضه على إنه ناقص.
   */
  const present = useMemo(
    () => new Set(sections.map((s) => renderType(s.type))),
    [sections],
  )

  const groups = useMemo(() => {
    const out = new Map<string, typeof BLOCK_LIBRARY>()
    for (const b of BLOCK_LIBRARY) {
      if (b.hidden || b.locked) continue
      if (present.has(renderType(b.type))) continue
      out.set(b.group, [...(out.get(b.group) ?? []), b])
    }
    return [...out.entries()]
  }, [present])

  return (
    <div className="flex flex-col gap-4">
      {saved && <Alert tone="success">اتحفظ. افتح متجرك عشان تشوف الصفحة الجديدة.</Alert>}

      <ul className="flex flex-col gap-2">
        {sections.map((section, i) => {
          const meta = blockMeta(section.type)
          const Icon = iconFor(meta.icon)
          const open = openId === section.id
          const title = String(section.settings?.title ?? section.settings?.heading ?? '').trim()

          return (
            <li
              key={section.id}
              className={cn(
                'surface overflow-hidden transition-colors',
                !section.enabled && 'opacity-60',
                open && 'ring-1 ring-[var(--primary)]',
              )}
            >
              <div className="flex items-center gap-2 p-3">
                <span
                  className={cn(
                    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                    section.enabled
                      ? 'bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'bg-[var(--surface-2)] text-[var(--fg-subtle)]',
                  )}
                  aria-hidden="true"
                >
                  {meta.locked ? <Lock className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>

                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : section.id)}
                  className="min-w-0 flex-1 text-start"
                  aria-expanded={open}
                >
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="text-sm font-medium">{meta.name}</span>
                    {title && <span className="truncate text-xs text-[var(--fg-muted)]">«{title}»</span>}
                    {!section.enabled && (
                      <span className="rounded-md bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--fg-subtle)]">
                        مخفي
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-[var(--fg-muted)]">{meta.description}</span>
                </button>

                <div className="flex shrink-0 items-center gap-0.5">
                  <Tool
                    label={section.enabled ? `إخفاء ${meta.name}` : `إظهار ${meta.name}`}
                    onClick={() =>
                      touch(sections.map((s) => (s.id === section.id ? { ...s, enabled: !s.enabled } : s)))
                    }
                  >
                    {section.enabled ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Tool>

                  <Tool label={`تحريك ${meta.name} لفوق`} onClick={() => move(i, -1)} disabled={i === 0 || meta.locked}>
                    <ArrowUp className="h-4 w-4" />
                  </Tool>

                  <Tool
                    label={`تحريك ${meta.name} لتحت`}
                    onClick={() => move(i, 1)}
                    disabled={i === sections.length - 1 || meta.locked}
                  >
                    <ArrowDown className="h-4 w-4" />
                  </Tool>

                  {!meta.locked && (
                    <>
                      <Tool label={`تكرار ${meta.name}`} onClick={() => duplicate(section)}>
                        <Copy className="h-4 w-4" />
                      </Tool>
                      <Tool
                        label={`حذف ${meta.name}`}
                        danger
                        onClick={() => {
                          touch(sections.filter((s) => s.id !== section.id))
                          if (open) setOpenId(null)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Tool>
                    </>
                  )}
                </div>
              </div>

              {open && (
                <div className="flex flex-col gap-6 border-t border-[var(--border)] bg-[var(--surface-2)] p-4">
                  <BlockSettings
                    type={section.type}
                    settings={section.settings ?? {}}
                    onChange={(s) => patch(section.id, s)}
                    categories={categories}
                    currency={currency}
                  />
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <button
        type="button"
        onClick={() => setAdding(true)}
        className="flex min-h-12 items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] text-sm font-semibold text-[var(--fg-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        زوّد قسم
      </button>

      <div className="sticky bottom-4 z-10 flex items-center gap-3">
        <Button onClick={save} loading={pending} disabled={!dirty}>
          <Save className="h-4 w-4" aria-hidden="true" />
          حفظ الصفحة
        </Button>
        {dirty && <span className="text-sm text-[var(--color-warning)]">فيه تعديلات مش محفوظة</span>}
      </div>

      {adding && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 backdrop-blur-sm sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="إضافة قسم"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdding(false)
          }}
        >
          <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-4">
              <div>
                <h2 className="font-semibold">زوّد قسم</h2>
                <p className="text-xs text-[var(--fg-muted)]">
                  دي الأقسام اللي لسه مش على صفحتك. عايز نسخة تانية من قسم موجود؟ استعمل زر
                  التكرار جنبه.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdding(false)}
                aria-label="إغلاق"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {groups.length === 0 ? (
                <p className="py-10 text-center text-sm leading-relaxed text-[var(--fg-muted)]">
                  كل الأقسام موجودة على صفحتك خلاص.
                  <br />
                  لو عايز نسخة تانية من قسم — قسم منتجات تاني مثلًا — دوس زر التكرار جنبه.
                </p>
              ) : (
              <div className="flex flex-col gap-6">
                {groups.map(([group, items]) => (
                  <section key={group} className="flex flex-col gap-2">
                    <h3 className="text-xs font-bold tracking-wide text-[var(--fg-subtle)]">{group}</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {items.map((b) => {
                        const Icon = iconFor(b.icon)
                        return (
                          <button
                            key={b.type}
                            type="button"
                            onClick={() => add(b.type)}
                            className="flex items-start gap-3 rounded-lg border border-[var(--border)] p-3 text-start transition-colors hover:border-[var(--primary)] hover:bg-[var(--surface-2)]"
                          >
                            <span
                              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--primary-soft)] text-[var(--primary)]"
                              aria-hidden="true"
                            >
                              <Icon className="h-4 w-4" />
                            </span>
                            <span className="min-w-0">
                              <span className="block text-sm font-medium">{b.name}</span>
                              <span className="block text-xs leading-relaxed text-[var(--fg-muted)]">
                                {b.description}
                              </span>
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </section>
                ))}
              </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Tool({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg transition-colors disabled:opacity-30',
        danger
          ? 'text-[var(--fg-muted)] hover:bg-red-50 hover:text-red-600'
          : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]',
      )}
    >
      {children}
    </button>
  )
}
