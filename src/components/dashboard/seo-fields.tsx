'use client'

import { useRef, useState } from 'react'
import { FileText, Link2, Search, Type } from 'lucide-react'
import {
  SEO_LIMITS,
  SEO_VARIABLES,
  renderSeo,
  renderSeoSlug,
  type SeoContext,
} from '@/lib/seo-template'

/**
 * محرّر السيو.
 *
 * ثلات قرارات في التصميم:
 *
 * ١. **الشيبس بيحط المتغيّر مكان المؤشّر** لا في آخر النص. التاجر
 *    اللي عايز «{Brand} — {Name}» ما يقدرش يكتبها لو كل ضغطة بترمي
 *    المتغيّر في الآخر.
 * ٢. **معاينة حيّة بشكل نتيجة جوجل.** الحقول دي مالهاش أثر ظاهر في
 *    اللوحة، والتاجر بيكتب على العمى من غيرها — ولا يشوف نتيجته غير
 *    بعد أسبوعين لما جوجل يفهرس.
 * ٣. **العدّاد بيلوّن عند حد جوجل** (٦٠ للعنوان و١٦٠ للوصف). القص
 *    بيحصل في نتيجة البحث لا هنا، فالتاجر لازم يعرف قبل ما يحفظ.
 */
export function SeoFields({
  defaultTitle,
  defaultSlug,
  defaultDescription,
  context,
}: {
  defaultTitle?: string | null
  defaultSlug?: string | null
  defaultDescription?: string | null
  /** بيانات المنتج الحيّة — بتتغيّر وهو بيكتب فالمعاينة بتتحرّك معاه */
  context: SeoContext
}) {
  const [title, setTitle] = useState(defaultTitle ?? '')
  const [slug, setSlug] = useState(defaultSlug ?? '')
  const [description, setDescription] = useState(defaultDescription ?? '')

  const previewTitle = renderSeo(title, context) || context.name || 'عنوان صفحة المنتج'
  const previewDesc = renderSeo(description, context)
  const previewSlug = renderSeoSlug(slug, context) || context.name

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="flex items-center gap-2 font-semibold">
          <Search className="h-4 w-4 text-[var(--fg-subtle)]" aria-hidden="true" />
          تحسين محركات البحث
        </h2>
        <p className="mt-1 text-sm text-[var(--fg-muted)]">
          ده اللي بيظهر في جوجل. اكتب القالب مرة، وكل منتج هياخد عنوانه منه.
        </p>
      </div>

      <SeoField
        icon={Type}
        label="عنوان صفحة المنتج"
        name="seoTitle"
        value={title}
        onChange={setTitle}
        placeholder="{Name} من {Brand}"
        field="title"
        limit={SEO_LIMITS.title}
        rendered={renderSeo(title, context)}
      />

      <SeoField
        icon={Link2}
        label="رابط صفحة المنتج"
        name="seoSlug"
        value={slug}
        onChange={setSlug}
        placeholder="{Name}"
        field="url"
        dir="ltr"
        hint="بيتحدّد مرة واحدة وقت الحفظ ومبيتغيّرش بعدها — عشان اللينكات القديمة ما تبقاش ٤٠٤."
        rendered={previewSlug}
      />

      <SeoField
        icon={FileText}
        label="وصف صفحة المنتج"
        name="seoDescription"
        value={description}
        onChange={setDescription}
        placeholder="{Name} — {Category} أصلي بسعر {Price}. شحن لكل المحافظات."
        field="description"
        limit={SEO_LIMITS.description}
        multiline
        rendered={previewDesc}
      />

      {/* معاينة نتيجة البحث */}
      <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
        <span className="mb-2 block text-xs font-medium text-[var(--fg-muted)]">
          كده هيظهر في جوجل
        </span>
        <div className="rounded-lg bg-[var(--surface)] p-3">
          <bdi dir="ltr" className="block truncate text-xs text-[var(--color-success)]">
            {context.store ? `${slugifyHost(context.store)} › ` : ''}
            {previewSlug || '…'}
          </bdi>
          <span className="mt-0.5 block truncate text-[15px] font-medium text-[var(--primary)]">
            {previewTitle}
          </span>
          <p className="mt-0.5 line-clamp-2 text-xs text-[var(--fg-muted)]">
            {previewDesc || 'اكتب وصفًا مختصرًا يشجّع على الضغط.'}
          </p>
        </div>
      </div>
    </div>
  )
}

function SeoField({
  icon: Icon,
  label,
  name,
  value,
  onChange,
  placeholder,
  field,
  limit,
  multiline,
  dir,
  hint,
  rendered,
}: {
  icon: typeof Type
  label: string
  name: string
  value: string
  onChange: (v: string) => void
  placeholder: string
  field: 'title' | 'url' | 'description'
  limit?: number
  multiline?: boolean
  dir?: 'ltr' | 'rtl'
  hint?: string
  rendered: string
}) {
  const ref = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)

  /** يحط المتغيّر مكان المؤشّر ويرجّع التركيز بعده */
  const insert = (token: string) => {
    const el = ref.current
    if (!el) {
      onChange(value + token)
      return
    }
    const start = el.selectionStart ?? value.length
    const end = el.selectionEnd ?? value.length
    const next = value.slice(0, start) + token + value.slice(end)
    onChange(next)

    requestAnimationFrame(() => {
      el.focus()
      const pos = start + token.length
      el.setSelectionRange(pos, pos)
    })
  }

  const chips = SEO_VARIABLES.filter((v) => v.fields.includes(field))
  const length = rendered.length
  const over = limit ? length > limit : false

  const inputClass =
    'w-full rounded-lg border bg-[var(--surface)] px-3 py-2.5 text-sm transition-colors focus:outline-none'
  const borderClass = focused
    ? 'border-[var(--primary)]'
    : 'border-[var(--border-strong)]'

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={name} className="flex items-center gap-1.5 text-sm font-medium">
        <Icon className="h-3.5 w-3.5 text-[var(--fg-subtle)]" aria-hidden="true" />
        {label}
      </label>

      {multiline ? (
        <textarea
          ref={ref as React.RefObject<HTMLTextAreaElement>}
          id={name}
          name={name}
          rows={3}
          value={value}
          dir={dir}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={`${inputClass} ${borderClass} resize-y`}
        />
      ) : (
        <input
          ref={ref as React.RefObject<HTMLInputElement>}
          id={name}
          name={name}
          value={value}
          dir={dir}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={`${inputClass} ${borderClass} ${dir === 'ltr' ? 'text-start' : ''}`}
        />
      )}

      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((v) => (
          <button
            key={v.token}
            type="button"
            onClick={() => insert(v.token)}
            title={`أضف ${v.label}`}
            /*
              ٤٤ بكسل على الموبايل: ده أقل مقاس الصباع بيجيبه بدقة.
              الشكل الصغير المضغوط يبان أنضف في اللقطة وبيتلخبط في
              الاستخدام — والتاجر بيدوس «التصنيف» فيجيب «الماركة».
            */
            className="flex min-h-11 items-center rounded-md bg-[var(--primary-soft)] px-3 text-xs font-medium text-[var(--primary)] transition-opacity hover:opacity-75 sm:min-h-8 sm:px-2"
          >
            {v.label}
          </button>
        ))}

        {limit && value.trim() !== '' && (
          <span
            className="tabular ms-auto text-xs"
            style={{ color: over ? 'var(--color-warning)' : 'var(--fg-subtle)' }}
          >
            {length}/{limit}
            {over && ' — جوجل هيقصّه'}
          </span>
        )}
      </div>

      {hint && <p className="text-xs text-[var(--fg-subtle)]">{hint}</p>}
    </div>
  )
}

/** اسم المتجر كأنه نطاق في معاينة نتيجة البحث */
function slugifyHost(store: string): string {
  return store.trim().replace(/\s+/g, '-').toLowerCase()
}
