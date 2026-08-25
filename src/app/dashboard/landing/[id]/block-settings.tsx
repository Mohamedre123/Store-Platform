'use client'

import { Plus, Trash2 } from 'lucide-react'
import type { Block } from '@/lib/landing'
import { ImageUpload } from '@/components/ui/image-upload'

const field =
  'w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--primary)] focus:outline-none'

/**
 * حقل نصّي لإعداد واحد.
 *
 * **معرَّف برّه `BlockSettings` عن قصد.** كان جوّها، فكل ضغطة حرف
 * كانت بتعمل دالة جديدة بهوية جديدة — ورياكت بيقرا الهوية الجديدة
 * على إنها نوع عنصر مختلف، فبيهدّ الـ`input` القديم ويبني واحدًا
 * جديدًا. والتركيز بيضيع مع العنصر المهدود، فالتاجر كان بيكتب حرفًا
 * ويقف ويدوس على الخانة تاني.
 *
 * المكوّن اللي بيتعرّف جوّه مكوّن تاني بيتهدّ ويتبني كل رندر دايمًا —
 * القاعدة دي مالهاش استثناء.
 */
function Text({
  s,
  set,
  k,
  label,
  multiline,
}: {
  s: Record<string, unknown>
  set: (patch: Record<string, unknown>) => void
  k: string
  label: string
  multiline?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {multiline ? (
        <textarea
          value={String(s[k] ?? '')}
          onChange={(e) => set({ [k]: e.target.value })}
          rows={4}
          className={field}
        />
      ) : (
        <input
          value={String(s[k] ?? '')}
          onChange={(e) => set({ [k]: e.target.value })}
          className={field}
        />
      )}
    </label>
  )
}

/**
 * إعدادات البلوك المختار.
 *
 * كل نوع بلوك ليه حقوله. الحقول بتكتب في نسخة من الإعدادات وبترجّعها
 * كاملة — المحرّر بيستبدل إعدادات البلوك مرة واحدة بدل ما يدمج حقلًا
 * حقلًا، وده بيمنع حالات نصف تحديث لما نضيف حقلًا جديدًا بعدين.
 */
export function BlockSettings({
  block,
  onChange,
}: {
  block: Block
  onChange: (settings: Record<string, unknown>) => void
}) {
  const s = block.settings
  const set = (patch: Record<string, unknown>) => onChange({ ...s, ...patch })

  switch (block.type) {
    case 'hero':
      return (
        <>
          <Text s={s} set={set} k="title" label="العنوان" />
          <Text s={s} set={set} k="subtitle" label="السطر التوضيحي" />
          <Text s={s} set={set} k="ctaLabel" label="نص الزرار" />
          <ImageUpload
            label="صورة الخلفية"
            value={s.image ? [String(s.image)] : []}
            onChange={(urls) => set({ image: urls[0] ?? null })}
            folder="banners"
          />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">تعتيم الصورة ({String(s.overlay ?? 40)}٪)</span>
            <input
              type="range"
              min={0}
              max={80}
              value={Number(s.overlay ?? 40)}
              onChange={(e) => set({ overlay: Number(e.target.value) })}
              className="accent-[var(--primary)]"
            />
            <span className="text-xs text-[var(--fg-subtle)]">
              التعتيم بيخلّي النص مقروءًا فوق الصورة.
            </span>
          </label>
        </>
      )

    case 'features':
      return (
        <>
          <Text s={s} set={set} k="title" label="عنوان القسم" />
          <ListEditor
            items={(s.items as Array<{ icon?: string; title: string; text: string }>) ?? []}
            onChange={(items) => set({ items })}
            blank={{ icon: 'check', title: '', text: '' }}
            addLabel="ضيف ميزة"
            render={(item, update) => (
              <>
                <input
                  value={item.title}
                  onChange={(e) => update({ ...item, title: e.target.value })}
                  placeholder="العنوان"
                  className={field}
                />
                <input
                  value={item.text}
                  onChange={(e) => update({ ...item, text: e.target.value })}
                  placeholder="الشرح"
                  className={field}
                />
              </>
            )}
          />
        </>
      )

    case 'product':
      return (
        <>
          <Text s={s} set={set} k="ctaLabel" label="نص زرار الشراء" />
          <Check2 label="اعرض السعر قبل الخصم" k="showCompareAt" s={s} set={set} />
          <Check2 label="اعرض عدّاد المخزون" k="showStock" s={s} set={set} />
        </>
      )

    case 'gallery':
      return (
        <>
          <Text s={s} set={set} k="title" label="عنوان القسم" />
          <ImageUpload
            label="الصور"
            value={(s.images as string[]) ?? []}
            onChange={(urls) => set({ images: urls })}
            folder="products"
            multiple
          />
        </>
      )

    case 'testimonials':
      return (
        <>
          <Text s={s} set={set} k="title" label="عنوان القسم" />
          <ListEditor
            items={(s.items as Array<{ name: string; text: string; rating?: number }>) ?? []}
            onChange={(items) => set({ items })}
            blank={{ name: '', text: '', rating: 5 }}
            addLabel="ضيف رأي"
            render={(item, update) => (
              <>
                <input
                  value={item.name}
                  onChange={(e) => update({ ...item, name: e.target.value })}
                  placeholder="اسم العميل"
                  className={field}
                />
                <textarea
                  value={item.text}
                  onChange={(e) => update({ ...item, text: e.target.value })}
                  placeholder="الرأي"
                  rows={2}
                  className={field}
                />
              </>
            )}
          />
        </>
      )

    case 'faq':
      return (
        <>
          <Text s={s} set={set} k="title" label="عنوان القسم" />
          <ListEditor
            items={(s.items as Array<{ q: string; a: string }>) ?? []}
            onChange={(items) => set({ items })}
            blank={{ q: '', a: '' }}
            addLabel="ضيف سؤال"
            render={(item, update) => (
              <>
                <input
                  value={item.q}
                  onChange={(e) => update({ ...item, q: e.target.value })}
                  placeholder="السؤال"
                  className={field}
                />
                <textarea
                  value={item.a}
                  onChange={(e) => update({ ...item, a: e.target.value })}
                  placeholder="الإجابة"
                  rows={2}
                  className={field}
                />
              </>
            )}
          />
        </>
      )

    case 'countdown':
      return (
        <>
          <Text s={s} set={set} k="title" label="العنوان" />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">المدة (دقيقة)</span>
            <input
              value={String(s.minutes ?? 30)}
              onChange={(e) => set({ minutes: Number(e.target.value) || 30 })}
              inputMode="numeric"
              dir="ltr"
              className={`${field} w-28 text-start tabular-nums`}
            />
            <span className="text-xs text-[var(--fg-subtle)]">
              العدّاد بيبدأ من أول زيارة للزائر وما بيرجعش للأول مع التحديث.
            </span>
          </label>
        </>
      )

    case 'cta':
      return (
        <>
          <Text s={s} set={set} k="title" label="العنوان" />
          <Text s={s} set={set} k="subtitle" label="السطر التوضيحي" />
          <Text s={s} set={set} k="ctaLabel" label="نص الزرار" />
        </>
      )

    case 'text':
      return (
        <>
          <Text s={s} set={set} k="title" label="العنوان" />
          <Text s={s} set={set} k="body" label="النص" multiline />
        </>
      )

    case 'video':
      return (
        <>
          <Text s={s} set={set} k="title" label="العنوان" />
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium">رابط يوتيوب</span>
            <input
              value={String(s.url ?? '')}
              onChange={(e) => set({ url: e.target.value })}
              dir="ltr"
              placeholder="https://youtu.be/..."
              className={`${field} text-start`}
            />
          </label>
        </>
      )

    default:
      return null
  }
}

function Check2({
  label,
  k,
  s,
  set,
}: {
  label: string
  k: string
  s: Record<string, unknown>
  set: (patch: Record<string, unknown>) => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={s[k] !== false}
        onChange={(e) => set({ [k]: e.target.checked })}
        className="h-4 w-4 accent-[var(--primary)]"
      />
      <span>{label}</span>
    </label>
  )
}

/** محرّر قائمة عناصر — مشترك بين المميزات والآراء والأسئلة */
function ListEditor<T>({
  items,
  onChange,
  blank,
  addLabel,
  render,
}: {
  items: T[]
  onChange: (items: T[]) => void
  blank: T
  addLabel: string
  render: (item: T, update: (next: T) => void) => React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-[var(--border)] p-2">
          {render(item, (next) => onChange(items.map((x, j) => (j === i ? next : x))))}
          <button
            type="button"
            onClick={() => onChange(items.filter((_, j) => j !== i))}
            className="flex w-fit items-center gap-1 text-xs text-[var(--fg-muted)] hover:text-[var(--color-danger)]"
          >
            <Trash2 className="h-3 w-3" aria-hidden="true" />
            حذف
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...items, structuredClone(blank)])}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-[var(--primary)] hover:underline"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
        {addLabel}
      </button>
    </div>
  )
}
