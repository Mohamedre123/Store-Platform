'use client'

import { useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'
import { Choice, ColorField, NumberField, Row, TextField, Toggle } from '@/components/dashboard/controls'
import { LinkPicker } from '@/components/dashboard/link-picker'
import { ImageUpload } from '@/components/ui/image-upload'
import { BG_LABELS, newSlide, type BgKey, type SlideItem } from '@/lib/blocks'
import { cn } from '@/lib/utils'

/**
 * الحقول المشتركة بين البلوكات.
 *
 * البلوكات كتير وأغلبها بيشترك في نفس الأجزاء: قايمة عناصر بتتزوّد
 * وتتشال وتترتّب، وشريحة بصورة ونص وزر، وخانة خلفية. الأجزاء دي
 * هنا مرة واحدة عشان تفضل متطابقة — التاجر بيتعلّم يستعملها مرة
 * ويلاقيها زي ما هي في كل بلوك.
 */

/* ────────────────────────── قايمة عناصر ────────────────────────── */

/**
 * قايمة بتتزوّد وتتشال وتترتّب.
 *
 * الترتيب أزرار لا سحب: السحب على الموبايل بيتعارض مع تمرير الصفحة،
 * والتاجر بيلاقي الصفحة بتنطّ وهو بيحاول ينقل عنصر. الأزرار بطيئة
 * شوية بس شغّالة على كل جهاز.
 */
export function ItemList<T extends { id: string }>({
  items,
  onChange,
  addLabel,
  make,
  max = 12,
  render,
}: {
  items: T[]
  onChange: (next: T[]) => void
  addLabel: string
  make: (id: string) => T
  max?: number
  render: (item: T, patch: (p: Partial<T>) => void, index: number) => ReactNode
}) {
  const [open, setOpen] = useState<string | null>(items[0]?.id ?? null)

  const patchAt = (id: string) => (p: Partial<T>) =>
    onChange(items.map((it) => (it.id === id ? { ...it, ...p } : it)))

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    onChange(next)
  }

  const add = () => {
    /*
      المعرّف من العدّاد + الطابع الزمني: لو اعتمدنا على الطول بس،
      التاجر اللي شال عنصرًا وضاف واحدًا بياخد نفس المعرّف — وReact
      بيعيد استعمال حالة العنصر القديم، فالصورة القديمة بتفضل ظاهرة.
    */
    const id = `i${items.length}-${Date.now().toString(36)}`
    const created = make(id)
    onChange([...items, created])
    setOpen(id)
  }

  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={item.id} className="rounded-lg border border-[var(--border)]">
          <div className="flex items-center gap-1 p-2">
            <button
              type="button"
              onClick={() => setOpen(open === item.id ? null : item.id)}
              className="min-w-0 flex-1 text-start text-sm font-medium"
            >
              العنصر {i + 1}
            </button>

            <Mini label="لفوق" onClick={() => move(i, -1)} disabled={i === 0}>
              <ArrowUp className="h-4 w-4" />
            </Mini>
            <Mini label="لتحت" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
              <ArrowDown className="h-4 w-4" />
            </Mini>
            <Mini label="حذف" onClick={() => onChange(items.filter((x) => x.id !== item.id))} danger>
              <Trash2 className="h-4 w-4" />
            </Mini>
          </div>

          {open === item.id && (
            <div className="flex flex-col gap-4 border-t border-[var(--border)] p-3">
              {render(item, patchAt(item.id), i)}
            </div>
          )}
        </div>
      ))}

      {items.length < max && (
        <button
          type="button"
          onClick={add}
          className="flex min-h-11 items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] text-sm font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {addLabel}
        </button>
      )}
    </div>
  )
}

function Mini({
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
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={cn(
        'flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-colors disabled:opacity-30',
        danger
          ? 'text-[var(--fg-muted)] hover:bg-red-50 hover:text-red-600'
          : 'text-[var(--fg-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--fg)]',
      )}
    >
      {children}
    </button>
  )
}

/* ────────────────────────── محرّر شريحة ────────────────────────── */

/**
 * الشريحة: صورتين ونص وزر.
 *
 * **صورتين لا واحدة.** البانر العريض على موبايل بيتقص لعامود ضيّق
 * في نصّه فالمنتج بيروح برّه الكادر. ولو التاجر رفع واحدة بس،
 * بنستعملها للاتنين بدل ما نسيب فراغ.
 */
export function SlideFields({
  slide,
  patch,
}: {
  slide: SlideItem
  patch: (p: Partial<SlideItem>) => void
}) {
  return (
    <>
      <ImageUpload
        label="صورة الكمبيوتر"
        value={slide.imageDesktop ? [slide.imageDesktop] : []}
        onChange={(urls) => patch({ imageDesktop: urls[0] ?? null })}
        folder="banners"
        specKey="heroDesktop"
      />
      <ImageUpload
        label="صورة الموبايل (اختيارية)"
        value={slide.imageMobile ? [slide.imageMobile] : []}
        onChange={(urls) => patch({ imageMobile: urls[0] ?? null })}
        folder="banners"
        specKey="heroMobile"
      />

      <TextField label="العنوان" value={slide.heading} onChange={(v) => patch({ heading: v })} />
      <TextField label="النص" value={slide.text} onChange={(v) => patch({ text: v })} multiline />

      <TextField
        label="نص الزر"
        value={slide.ctaLabel}
        onChange={(v) => patch({ ctaLabel: v })}
        hint="سيبه فاضي لو مش عايز زر."
      />

      <LinkPicker value={slide.ctaUrl} onChange={(v) => patch({ ctaUrl: v })} />

      {slide.ctaLabel.trim() && (
        <>
          <ColorField
            label="لون الزر"
            value={slide.ctaBg || '#ffffff'}
            onChange={(v) => patch({ ctaBg: v })}
          />
          <ColorField
            label="لون الكلام جوّه الزر"
            value={slide.ctaColor || '#111111'}
            onChange={(v) => patch({ ctaColor: v })}
          />
        </>
      )}

      <Choice
        label="مكان النص"
        value={slide.textPosition}
        onChange={(v) => patch({ textPosition: v })}
        options={[
          { value: 'start', label: 'يمين' },
          { value: 'center', label: 'نص' },
          { value: 'end', label: 'شمال' },
        ]}
      />

      <ColorField
        label="لون العنوان والوصف"
        value={slide.textColor}
        onChange={(v) => patch({ textColor: v })}
      />

      <NumberField
        label="تعتيم الصورة"
        value={slide.overlay}
        onChange={(v) => patch({ overlay: Math.min(90, Math.max(0, v)) })}
        min={0}
        max={90}
        suffix="%"
        hint="النص الأبيض على صورة فاتحة ما بيتقراش من غير تعتيم"
      />

      <Toggle
        label="خلفية ضبابية ورا الكلام"
        hint="لوح مضبّب ورا الكلام والزر بس — الصورة تفضل واضحة. شغّلها لو الكلام بيتوه في الصورة."
        checked={slide.blurEnabled}
        onChange={(v) => patch({ blurEnabled: v, blur: v ? slide.blur || 18 : slide.blur })}
      />

      {slide.blurEnabled && (
        <NumberField
          label="شدّة الضبابية"
          value={slide.blur}
          onChange={(v) => patch({ blur: Math.min(40, Math.max(2, v)) })}
          min={2}
          max={40}
          suffix="px"
        />
      )}
    </>
  )
}

export const makeSlide = (id: string) => newSlide(id)

/* ────────────────────────── خلفية ────────────────────────── */

export function BackgroundField({
  value,
  onChange,
}: {
  value: BgKey
  onChange: (v: BgKey) => void
}) {
  return (
    <Choice
      label="خلفية القسم"
      value={value}
      onChange={onChange}
      options={(['none', 'soft', 'contrast'] as BgKey[]).map((k) => ({ value: k, label: BG_LABELS[k] }))}
      hint="بتفصل القسم عن اللي فوقه — مفيدة لما الأقسام كتير"
    />
  )
}

/* ────────────────────────── وقت الانتهاء ────────────────────────── */

/**
 * لحظة انتهاء حقيقية.
 *
 * `datetime-local` بيدّي التاجر منتقي تاريخ ووقت من المتصفح نفسه —
 * والقيمة بتتخزّن ISO عشان تفضل مفهومة مهما اتغيّرت المنطقة.
 */
export function DeadlineField({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  /* ISO فيه ثواني ومنطقة، والخانة عايزة YYYY-MM-DDTHH:mm محلّي */
  const local = (() => {
    const t = Date.parse(value)
    if (Number.isNaN(t)) return ''
    const d = new Date(t - new Date().getTimezoneOffset() * 60_000)
    return d.toISOString().slice(0, 16)
  })()

  return (
    <Row
      label="بينتهي إمتى"
      hint="لحظة واحدة لكل العملاء. العدّاد اللي بيبدأ من أول ما العميل يفتح الصفحة بيتكشف بأول تحديث."
    >
      <input
        type="datetime-local"
        value={local}
        onChange={(e) => {
          const v = e.target.value
          onChange(v ? new Date(v).toISOString() : '')
        }}
        dir="ltr"
        className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-start text-sm focus:border-[var(--primary)] focus:outline-none"
      />
    </Row>
  )
}

/* ────────────────────────── مفتاح مختصر ────────────────────────── */

export function Switch({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return <Toggle label={label} hint={hint} checked={checked} onChange={onChange} />
}
