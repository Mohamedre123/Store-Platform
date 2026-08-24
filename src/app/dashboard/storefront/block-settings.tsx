'use client'

import { useState } from 'react'
import { Boxes, Pencil } from 'lucide-react'
import {
  Choice,
  ColorField,
  Group,
  NumberField,
  Row,
  TextField,
  Toggle,
} from '@/components/dashboard/controls'
import { ImageUpload } from '@/components/ui/image-upload'
import { ProductPicker } from './product-picker'
import { BackgroundField, DeadlineField, ItemList, SlideFields, makeSlide } from './block-fields'
import { LinkPicker } from '@/components/dashboard/link-picker'
import { FEATURE_ICONS, FEATURE_ICON_LABELS } from '@/components/storefront/blocks/content'
import type { PickerCategory } from './picker-actions'
import {
  PRODUCT_SOURCES,
  readBlock,
  renderType,
  type BgKey,
  type BlockType,
} from '@/lib/blocks'
import { cn } from '@/lib/utils'

/**
 * إعدادات البلوك الواحد.
 *
 * كل نوع بلوك بياخد خياراته هو بس. الشاشة اللي بتعرض كل الخيارات
 * لكل الأنواع بتبقى مرهقة لدرجة إن التاجر بيقفلها من غير ما يغيّر
 * حاجة — والخيار اللي محدّش لقاه كأنه مش موجود.
 */

export type Patch = (settings: Record<string, unknown>) => void

export function BlockSettings({
  type,
  settings,
  onChange,
  categories,
  currency,
}: {
  type: string
  settings: Record<string, unknown>
  onChange: Patch
  categories: PickerCategory[]
  currency: string
}) {
  const kind = renderType(type) as BlockType

  switch (kind) {
    case 'products':
      return (
        <ProductsSettings
          settings={settings}
          onChange={onChange}
          categories={categories}
          currency={currency}
        />
      )
    case 'categories':
      return <CategoriesSettings settings={settings} onChange={onChange} categories={categories} />
    case 'banner':
      return <BannerSettings settings={settings} onChange={onChange} />
    case 'slides':
      return <SlidesSettings settings={settings} onChange={onChange} />
    case 'countdown':
      return <CountdownSettings settings={settings} onChange={onChange} />
    case 'rich_text':
      return <RichTextSettings settings={settings} onChange={onChange} />
    case 'features':
      return <FeaturesSettings settings={settings} onChange={onChange} />
    case 'testimonials':
      return <TestimonialsSettings settings={settings} onChange={onChange} />
    case 'faq':
      return <FaqSettings settings={settings} onChange={onChange} />
    case 'video':
      return <VideoSettings settings={settings} onChange={onChange} />
    case 'logos':
      return <LogosSettings settings={settings} onChange={onChange} />
    case 'gallery':
      return <GallerySettings settings={settings} onChange={onChange} />
    case 'newsletter':
      return <NewsletterSettings settings={settings} onChange={onChange} />
    default:
      return (
        <p className="text-sm text-[var(--fg-muted)]">
          البلوك ده مالوش إعدادات — بيتحكّم فيه من مكان تاني في اللوحة.
        </p>
      )
  }
}

/* ────────────────────────── منتجات ────────────────────────── */

function ProductsSettings({
  settings,
  onChange,
  categories,
  currency,
}: {
  settings: Record<string, unknown>
  onChange: Patch
  categories: PickerCategory[]
  currency: string
}) {
  const b = readBlock('products', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })
  const [pickerOpen, setPickerOpen] = useState(false)

  return (
    <>
      <Group title="المحتوى">
        <TextField label="العنوان" value={b.title} onChange={(v) => set({ title: v })} />
        <TextField
          label="سطر تحت العنوان"
          value={b.subtitle}
          onChange={(v) => set({ subtitle: v })}
          placeholder="اختياري"
        />

        <Choice
          label="المنتجات بتيجي منين"
          value={b.source}
          onChange={(v) => set({ source: v })}
          options={PRODUCT_SOURCES.map((s) => ({ value: s.value, label: s.label }))}
          columns={3}
          hint={PRODUCT_SOURCES.find((s) => s.value === b.source)?.hint}
        />

        {b.source === 'category' && (
          <>
            <Row label="القسم">
              <select
                value={b.categoryId ?? ''}
                onChange={(e) => set({ categoryId: e.target.value || null })}
                className="h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
              >
                <option value="">اختار قسمًا</option>
                {categoryOptions(categories).map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </Row>

            <Toggle
              label="يشمل الأقسام الفرعية"
              hint="القسم اللي تحته أقسام بيفضل فاضي من غير الخيار ده"
              checked={b.includeChildren}
              onChange={(v) => set({ includeChildren: v })}
            />
          </>
        )}

        {b.source === 'manual' && (
          <Row
            label="المنتجات المختارة"
            hint="بيتعرضوا بالترتيب اللي تحدّده — الأول في القايمة هو الأول في المتجر"
          >
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:border-[var(--primary)] hover:text-[var(--primary)]"
            >
              {b.productIds.length > 0 ? (
                <>
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  {b.productIds.length} منتج مختار — عدّل
                </>
              ) : (
                <>
                  <Boxes className="h-4 w-4" aria-hidden="true" />
                  اختار منتجاتك
                </>
              )}
            </button>
          </Row>
        )}

        {b.source !== 'manual' && (
          <NumberField
            label="عدد المنتجات"
            value={b.limit}
            onChange={(v) => set({ limit: Math.min(48, Math.max(1, v)) })}
            min={1}
            max={48}
          />
        )}
      </Group>

      <Group title="الشكل">
        <Choice
          label="طريقة العرض"
          value={b.layout}
          onChange={(v) => set({ layout: v })}
          options={[
            { value: 'grid', label: 'شبكة' },
            { value: 'carousel', label: 'شريط' },
            { value: 'tiles', label: 'فسيفساء' },
          ]}
          hint={
            b.layout === 'carousel'
              ? 'صف واحد بيتصفّح — بيوفّر طول الصفحة'
              : b.layout === 'tiles'
                ? 'أول منتج بياخد مساحة مضاعفة — نقطة بداية للعين'
                : 'الشكل المعتاد'
          }
        />

        <Choice
          label="أعمدة الكمبيوتر"
          value={b.columns}
          onChange={(v) => set({ columns: v })}
          options={[
            { value: 0, label: 'زي الافتراضي' },
            { value: 2, label: '٢' },
            { value: 3, label: '٣' },
            { value: 4, label: '٤' },
            { value: 5, label: '٥' },
          ]}
          columns={5}
        />

        <Choice
          label="شكل البطاقة"
          value={b.cardStyle}
          onChange={(v) => set({ cardStyle: v })}
          options={[
            { value: 'inherit', label: 'زي الثيم' },
            { value: 'clean', label: 'بسيطة' },
            { value: 'framed', label: 'بإطار' },
            { value: 'overlay', label: 'نص فوق الصورة' },
            { value: 'editorial', label: 'واسعة' },
            { value: 'compact', label: 'صف' },
          ]}
          columns={3}
        />

        <Choice
          label="نسبة الصورة"
          value={b.imageRatio}
          onChange={(v) => set({ imageRatio: v })}
          options={[
            { value: 'inherit', label: 'زي الثيم' },
            { value: 'square', label: 'مربّعة' },
            { value: 'portrait', label: 'طولية' },
            { value: 'wide', label: 'عرضية' },
          ]}
          columns={4}
        />

        <BackgroundField value={b.background} onChange={(v) => set({ background: v })} />
      </Group>

      <Group title="الأزرار">
        <Choice
          label="زر البطاقة"
          value={b.action}
          onChange={(v) => set({ action: v })}
          options={[
            { value: 'inherit', label: 'زي الثيم' },
            { value: 'add', label: 'أضف للسلة' },
            { value: 'choose', label: 'الخيارات على الكارت' },
            { value: 'options', label: 'يفتح صفحة المنتج' },
            { value: 'none', label: 'من غير زر' },
          ]}
          columns={3}
          hint={
            b.action === 'add'
              ? 'ضغطة واحدة. المنتج اللي ليه مقاسات بيتضاف من غير اختيار، والعميل بيحدّد خياراته من جوّه السلة.'
              : b.action === 'choose'
                ? 'المقاسات والألوان بتبان على البطاقة نفسها، والعميل يحدّد وياخد «أضف للسلة» من مكانه. والمنتج اللي مالوش خيارات بياخد زر الإضافة عادي — فمنتجاتك مش هتدخل في بعضها.'
                : b.action === 'options'
                  ? 'بيودّي لصفحة المنتج — مناسب لما التفاصيل مهمّة قبل الشراء'
                  : undefined
          }
        />

        <Toggle
          label="زر «المزيد» تحت القسم"
          hint="بيفتح القسم اللي البلوك بيعرضه، أو كل المنتجات"
          checked={b.moreEnabled}
          onChange={(v) => set({ moreEnabled: v })}
        />

        {b.moreEnabled && (
          <>
            <TextField label="نص الزر" value={b.moreLabel} onChange={(v) => set({ moreLabel: v })} />
            <LinkPicker
              label="وجهة الزر"
              hint="سيبها «من غير رابط» عشان يودّي للقسم اللي البلوك بيعرضه."
              value={b.moreUrl}
              onChange={(v) => set({ moreUrl: v })}
            />
          </>
        )}
      </Group>

      <ProductPicker
        open={pickerOpen}
        value={b.productIds}
        categories={categories}
        currency={currency}
        onClose={() => setPickerOpen(false)}
        onChange={(ids) => set({ productIds: ids })}
      />
    </>
  )
}

/** أقسام مسطّحة بمستوى واحد — الفرعي بيبان تحت أبوه */
function categoryOptions(categories: PickerCategory[]) {
  const out: Array<{ id: string; label: string }> = []
  for (const parent of categories.filter((c) => !c.parentId)) {
    out.push({ id: parent.id, label: parent.name })
    for (const child of categories.filter((c) => c.parentId === parent.id)) {
      out.push({ id: child.id, label: `‏— ${child.name}` })
    }
  }
  return out
}

/* ────────────────────────── الأقسام ────────────────────────── */

function CategoriesSettings({
  settings,
  onChange,
  categories,
}: {
  settings: Record<string, unknown>
  onChange: Patch
  categories: PickerCategory[]
}) {
  const b = readBlock('categories', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })

  const toggleCat = (id: string) =>
    set({
      categoryIds: b.categoryIds.includes(id)
        ? b.categoryIds.filter((c) => c !== id)
        : [...b.categoryIds, id],
    })

  return (
    <>
      <Group title="المحتوى">
        <TextField label="العنوان" value={b.title} onChange={(v) => set({ title: v })} />
        <TextField
          label="سطر تحت العنوان"
          value={b.subtitle}
          onChange={(v) => set({ subtitle: v })}
          placeholder="اختياري"
        />

        <Row
          label="الأقسام المعروضة"
          hint={
            b.categoryIds.length === 0
              ? 'مش محدّد حاجة = كل الأقسام بترتيبها'
              : `${b.categoryIds.length} قسم مختار — بيتعرضوا بترتيب اختيارك`
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {categoryOptions(categories).map((c) => {
              const on = b.categoryIds.includes(c.id)
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCat(c.id)}
                  aria-pressed={on}
                  className={cn(
                    'min-h-9 rounded-lg border px-3 text-xs font-medium transition-colors',
                    on
                      ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                      : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
                  )}
                >
                  {c.label}
                </button>
              )
            })}
            {categories.length === 0 && (
              <p className="text-xs text-[var(--fg-muted)]">لسه مافيش أقسام في متجرك.</p>
            )}
          </div>
        </Row>

        <NumberField
          label="أقصى عدد"
          value={b.limit}
          onChange={(v) => set({ limit: Math.min(24, Math.max(1, v)) })}
          min={1}
          max={24}
        />
      </Group>

      <Group title="الشكل">
        <Choice
          label="طريقة العرض"
          value={b.layout}
          onChange={(v) => set({ layout: v })}
          options={[
            { value: 'circle', label: 'دواير' },
            { value: 'card', label: 'كروت' },
            { value: 'tile', label: 'الاسم فوق الصورة' },
          ]}
        />

        <Choice
          label="أعمدة الكمبيوتر"
          value={b.columns}
          onChange={(v) => set({ columns: v })}
          options={[
            { value: 3, label: '٣' },
            { value: 4, label: '٤' },
            { value: 5, label: '٥' },
            { value: 6, label: '٦' },
          ]}
          columns={4}
        />

        <Toggle
          label="عدد المنتجات جنب اسم القسم"
          checked={b.showCount}
          onChange={(v) => set({ showCount: v })}
        />

        <BackgroundField value={b.background} onChange={(v) => set({ background: v })} />
      </Group>
    </>
  )
}

/* ────────────────────────── بانر ────────────────────────── */

function BannerSettings({ settings, onChange }: { settings: Record<string, unknown>; onChange: Patch }) {
  const b = readBlock('banner', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })

  return (
    <>
      <Group title="البانرات">
        <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
          بانر واحد بياخد العرض كله، واتنين بيقفوا نص ونص، وتلاتة بيتقسموا بالتساوي.
        </p>
        <ItemList
          items={b.items}
          onChange={(items) => set({ items })}
          addLabel="زوّد بانر جنبه"
          make={makeSlide}
          max={3}
          render={(item, patch) => <SlideFields slide={item} patch={patch} />}
        />
      </Group>

      <Group title="الشكل">
        <Choice
          label="الارتفاع"
          value={b.height}
          onChange={(v) => set({ height: v })}
          options={[
            { value: 'sm', label: 'قصير' },
            { value: 'md', label: 'متوسط' },
            { value: 'lg', label: 'طويل' },
          ]}
        />
        <Toggle label="حواف دايرة" checked={b.rounded} onChange={(v) => set({ rounded: v })} />
        <Toggle
          label="يمتد لعرض الشاشة"
          hint="من غير هوامش جانبية — بيدّي إحساس أوسع"
          checked={b.full}
          onChange={(v) => set({ full: v })}
        />
      </Group>
    </>
  )
}

/* ────────────────────────── شرائح ────────────────────────── */

function SlidesSettings({ settings, onChange }: { settings: Record<string, unknown>; onChange: Patch }) {
  const b = readBlock('slides', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })

  return (
    <>
      <Group title="الشرائح">
        <ItemList
          items={b.items}
          onChange={(items) => set({ items })}
          addLabel="زوّد شريحة"
          make={makeSlide}
          max={8}
          render={(item, patch) => <SlideFields slide={item} patch={patch} />}
        />
      </Group>

      <Group title="الحركة">
        <Choice
          label="الارتفاع"
          value={b.height}
          onChange={(v) => set({ height: v })}
          options={[
            { value: 'sm', label: 'قصير' },
            { value: 'md', label: 'متوسط' },
            { value: 'lg', label: 'طويل' },
            { value: 'full', label: 'شاشة كاملة' },
          ]}
          columns={4}
        />

        <Toggle
          label="تتبدّل لوحدها"
          hint="بتقف لما العميل يلمسها أو يمرّر عليها"
          checked={b.autoplay}
          onChange={(v) => set({ autoplay: v })}
        />

        {b.autoplay && (
          <NumberField
            label="كل قد إيه"
            value={b.intervalSeconds}
            onChange={(v) => set({ intervalSeconds: Math.min(20, Math.max(2, v)) })}
            min={2}
            max={20}
            suffix="ثانية"
          />
        )}

        <Toggle label="نقط تحت" checked={b.showDots} onChange={(v) => set({ showDots: v })} />
        <Toggle label="أسهم على الجنب" checked={b.showArrows} onChange={(v) => set({ showArrows: v })} />
      </Group>
    </>
  )
}

/* ────────────────────────── عرض بعدّاد ────────────────────────── */

function CountdownSettings({ settings, onChange }: { settings: Record<string, unknown>; onChange: Patch }) {
  const b = readBlock('countdown', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })

  return (
    <>
      <Group title="المحتوى">
        <TextField label="العنوان" value={b.heading} onChange={(v) => set({ heading: v })} />
        <TextField label="النص" value={b.text} onChange={(v) => set({ text: v })} multiline />

        <DeadlineField value={b.endsAt} onChange={(v) => set({ endsAt: v })} />

        <Choice
          label="لما ينتهي"
          value={b.whenDone}
          onChange={(v) => set({ whenDone: v })}
          options={[
            { value: 'hide', label: 'يختفي' },
            { value: 'repeat', label: 'يعيد كل يوم' },
            { value: 'keep', label: 'يفضل بصفر' },
          ]}
          hint={
            b.whenDone === 'repeat'
              ? 'للعرض اليومي المتكرّر — بينقل لنفس الساعة بكرة'
              : b.whenDone === 'keep'
                ? 'العدّاد الواقف على صفر بيبان إهمالًا — استعمله لو هتغيّر التاريخ بنفسك'
                : 'الأنضف: البلوك بيسيب مكانه بالكامل'
          }
        />

        <TextField label="نص الزر" value={b.ctaLabel} onChange={(v) => set({ ctaLabel: v })} />
        <LinkPicker value={b.ctaUrl} onChange={(v) => set({ ctaUrl: v })} />

        {b.ctaLabel.trim() && (
          <>
            <ColorField label="لون الزر" value={b.ctaBg || '#ffffff'} onChange={(v) => set({ ctaBg: v })} />
            <ColorField
              label="لون الكلام جوّه الزر"
              value={b.ctaColor || '#111111'}
              onChange={(v) => set({ ctaColor: v })}
            />
          </>
        )}
      </Group>

      <Group title="الشكل">
        <ImageUpload
          label="صورة خلفية (اختيارية)"
          value={b.image ? [b.image] : []}
          onChange={(urls) => set({ image: urls[0] ?? null })}
          folder="banners"
          specKey="promoBanner"
        />
        <ColorField label="لون الخلفية" value={b.background} onChange={(v) => set({ background: v })} />
        <ColorField label="لون النص" value={b.textColor} onChange={(v) => set({ textColor: v })} />

        <NumberField
          label="تعتيم الصورة"
          value={b.overlay}
          onChange={(v) => set({ overlay: Math.min(90, Math.max(0, v)) })}
          min={0}
          max={90}
          suffix="%"
        />
        <Toggle
          label="خلفية ضبابية ورا الكلام"
          hint="لوح مضبّب ورا الكلام والزر بس — الصورة تفضل واضحة."
          checked={b.blurEnabled}
          onChange={(v) => set({ blurEnabled: v, blur: v ? b.blur || 18 : b.blur })}
        />

        {b.blurEnabled && (
          <NumberField
            label="شدّة الضبابية"
            value={b.blur}
            onChange={(v) => set({ blur: Math.min(40, Math.max(2, v)) })}
            min={2}
            max={40}
            suffix="px"
          />
        )}
      </Group>
    </>
  )
}

/* ────────────────────────── نص وزر ────────────────────────── */

function RichTextSettings({ settings, onChange }: { settings: Record<string, unknown>; onChange: Patch }) {
  const b = readBlock('rich_text', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })

  return (
    <>
      <Group title="المحتوى">
        <TextField label="العنوان" value={b.heading} onChange={(v) => set({ heading: v })} />
        <TextField
          label="الكلام"
          value={b.body}
          onChange={(v) => set({ body: v })}
          multiline
          hint="كل سطر بيبقى فقرة لوحدها"
        />
        <TextField label="نص الزر" value={b.ctaLabel} onChange={(v) => set({ ctaLabel: v })} />
        <LinkPicker value={b.ctaUrl} onChange={(v) => set({ ctaUrl: v })} />

        {b.ctaLabel.trim() && (
          <>
            <ColorField
              label="لون الزر"
              value={b.ctaBg || '#000000'}
              onChange={(v) => set({ ctaBg: v })}
            />
            <ColorField
              label="لون الكلام جوّه الزر"
              value={b.ctaColor || '#ffffff'}
              onChange={(v) => set({ ctaColor: v })}
            />
          </>
        )}
      </Group>

      <Group title="الشكل">
        <Choice
          label="محاذاة"
          value={b.align}
          onChange={(v) => set({ align: v })}
          options={[
            { value: 'start', label: 'يمين' },
            { value: 'center', label: 'نص' },
          ]}
          columns={2}
        />
        <Choice
          label="العرض"
          value={b.width}
          onChange={(v) => set({ width: v })}
          options={[
            { value: 'narrow', label: 'ضيّق' },
            { value: 'wide', label: 'واسع' },
          ]}
          columns={2}
          hint="الضيّق أسهل في القراءة — السطر الطويل بيتعب العين"
        />
        <BackgroundField value={b.background} onChange={(v) => set({ background: v })} />
      </Group>
    </>
  )
}

/* ────────────────────────── مميّزات ────────────────────────── */

function FeaturesSettings({ settings, onChange }: { settings: Record<string, unknown>; onChange: Patch }) {
  const b = readBlock('features', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })

  return (
    <>
      <Group title="المميّزات">
        <TextField
          label="العنوان"
          value={b.title}
          onChange={(v) => set({ title: v })}
          placeholder="اختياري"
        />

        <ItemList
          items={b.items}
          onChange={(items) => set({ items })}
          addLabel="زوّد ميزة"
          make={(id) => ({ id, icon: 'badge-check', title: '', text: '' })}
          max={8}
          render={(item, patch) => (
            <>
              <TextField label="العنوان" value={item.title} onChange={(v) => patch({ title: v })} />
              <TextField label="السطر الصغير" value={item.text} onChange={(v) => patch({ text: v })} />

              <Row label="الأيقونة">
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(FEATURE_ICONS).map(([key, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => patch({ icon: key })}
                      aria-label={FEATURE_ICON_LABELS[key] ?? key}
                      aria-pressed={item.icon === key}
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-lg border transition-colors',
                        item.icon === key
                          ? 'border-[var(--primary)] bg-[var(--primary-soft)] text-[var(--primary)]'
                          : 'border-[var(--border-strong)] text-[var(--fg-muted)] hover:bg-[var(--surface-2)]',
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </Row>
            </>
          )}
        />
      </Group>

      <Group title="الشكل">
        <Choice
          label="أعمدة"
          value={b.columns}
          onChange={(v) => set({ columns: v })}
          options={[
            { value: 2, label: '٢' },
            { value: 3, label: '٣' },
            { value: 4, label: '٤' },
          ]}
        />
        <Choice
          label="الإطار"
          value={b.style}
          onChange={(v) => set({ style: v })}
          options={[
            { value: 'plain', label: 'بدون' },
            { value: 'card', label: 'كارت' },
            { value: 'bordered', label: 'خط' },
          ]}
        />
        <BackgroundField value={b.background} onChange={(v) => set({ background: v })} />
      </Group>
    </>
  )
}

/* ────────────────────────── آراء العملاء ────────────────────────── */

function TestimonialsSettings({ settings, onChange }: { settings: Record<string, unknown>; onChange: Patch }) {
  const b = readBlock('testimonials', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })

  return (
    <>
      <Group title="الآراء">
        <TextField label="العنوان" value={b.title} onChange={(v) => set({ title: v })} />
        <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
          حطّ كلام عملاء اشتروا فعلًا. الرأي المخترع بيتكشف بسهولة وبيضرّ الثقة في المتجر كله.
        </p>

        <ItemList
          items={b.items}
          onChange={(items) => set({ items })}
          addLabel="زوّد رأي"
          make={(id) => ({ id, name: '', text: '', rating: 5, avatar: null })}
          max={12}
          render={(item, patch) => (
            <>
              <TextField label="الاسم" value={item.name} onChange={(v) => patch({ name: v })} />
              <TextField label="الرأي" value={item.text} onChange={(v) => patch({ text: v })} multiline />
              <NumberField
                label="التقييم"
                value={item.rating}
                onChange={(v) => patch({ rating: Math.min(5, Math.max(0, v)) })}
                min={0}
                max={5}
                suffix="من ٥"
              />
              <ImageUpload
                label="صورة (اختيارية)"
                value={item.avatar ? [item.avatar] : []}
                onChange={(urls) => patch({ avatar: urls[0] ?? null })}
                folder="misc"
              />
            </>
          )}
        />
      </Group>

      <Group title="الشكل">
        <Choice
          label="طريقة العرض"
          value={b.layout}
          onChange={(v) => set({ layout: v })}
          options={[
            { value: 'grid', label: 'شبكة' },
            { value: 'carousel', label: 'شريط' },
          ]}
          columns={2}
        />
        <BackgroundField value={b.background} onChange={(v) => set({ background: v })} />
      </Group>
    </>
  )
}

/* ────────────────────────── أسئلة شائعة ────────────────────────── */

function FaqSettings({ settings, onChange }: { settings: Record<string, unknown>; onChange: Patch }) {
  const b = readBlock('faq', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })

  return (
    <>
      <Group title="الأسئلة">
        <TextField label="العنوان" value={b.title} onChange={(v) => set({ title: v })} />
        <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
          حطّ الأسئلة اللي بتتكرر في رسايلك: بيوصل امتى؟ ينفع إرجاع؟ الشحن بكام؟ كل سؤال هنا رسالة
          أقل عندك وطلب أسرع عند العميل.
        </p>

        <ItemList
          items={b.items}
          onChange={(items) => set({ items })}
          addLabel="زوّد سؤال"
          make={(id) => ({ id, q: '', a: '' })}
          max={20}
          render={(item, patch) => (
            <>
              <TextField label="السؤال" value={item.q} onChange={(v) => patch({ q: v })} />
              <TextField label="الإجابة" value={item.a} onChange={(v) => patch({ a: v })} multiline />
            </>
          )}
        />
      </Group>

      <BackgroundField value={b.background} onChange={(v) => set({ background: v })} />
    </>
  )
}

/* ────────────────────────── فيديو ────────────────────────── */

function VideoSettings({ settings, onChange }: { settings: Record<string, unknown>; onChange: Patch }) {
  const b = readBlock('video', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })

  return (
    <>
      <Group title="الفيديو">
        <TextField
          label="رابط الفيديو"
          value={b.url}
          onChange={(v) => set({ url: v })}
          ltr
          placeholder="https://youtube.com/watch?v=…"
          hint="يوتيوب أو فيميو أو رابط ملف mp4. الصق الرابط زي ما هو من شريط العنوان."
        />
        <TextField label="العنوان" value={b.title} onChange={(v) => set({ title: v })} placeholder="اختياري" />
        <TextField label="سطر تحت العنوان" value={b.text} onChange={(v) => set({ text: v })} placeholder="اختياري" />
        <ImageUpload
          label="صورة الغلاف (لملفات mp4)"
          value={b.poster ? [b.poster] : []}
          onChange={(urls) => set({ poster: urls[0] ?? null })}
          folder="misc"
        />
      </Group>

      <Group title="الشكل">
        <Choice
          label="نسبة الأبعاد"
          value={b.ratio}
          onChange={(v) => set({ ratio: v })}
          options={[
            { value: '16:9', label: 'عريض' },
            { value: '4:3', label: 'كلاسيك' },
            { value: '1:1', label: 'مربّع' },
            { value: '9:16', label: 'ريلز' },
          ]}
          columns={4}
        />
        <Choice
          label="العرض"
          value={b.width}
          onChange={(v) => set({ width: v })}
          options={[
            { value: 'narrow', label: 'ضيّق' },
            { value: 'wide', label: 'واسع' },
            { value: 'full', label: 'كامل' },
          ]}
        />
        <BackgroundField value={b.background} onChange={(v) => set({ background: v })} />
      </Group>
    </>
  )
}

/* ────────────────────────── شعارات ────────────────────────── */

function LogosSettings({ settings, onChange }: { settings: Record<string, unknown>; onChange: Patch }) {
  const b = readBlock('logos', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })

  return (
    <>
      <Group title="الشعارات">
        <TextField label="العنوان" value={b.title} onChange={(v) => set({ title: v })} placeholder="اختياري" />

        <ItemList
          items={b.items}
          onChange={(items) => set({ items })}
          addLabel="زوّد شعار"
          make={(id) => ({ id, image: '', alt: '', url: '' })}
          max={20}
          render={(item, patch) => (
            <>
              <ImageUpload
                label="الشعار"
                value={item.image ? [item.image] : []}
                onChange={(urls) => patch({ image: urls[0] ?? '' })}
                folder="logos"
              />
              <TextField label="الاسم" value={item.alt} onChange={(v) => patch({ alt: v })} />
              <LinkPicker label="يودّي فين" value={item.url} onChange={(v) => patch({ url: v })} />
            </>
          )}
        />
      </Group>

      <Group title="الشكل">
        <Toggle
          label="شريط متحرّك"
          hint="بيلفّ لوحده — بيوفّر مساحة لما الشعارات كتير، وبيقف لما العميل يمرّر عليه"
          checked={b.marquee}
          onChange={(v) => set({ marquee: v })}
        />
        <Toggle
          label="أبيض وأسود"
          hint="بيخلّي الشعارات المتنافرة تبان متّسقة، وبترجع بألوانها عند المرور"
          checked={b.grayscale}
          onChange={(v) => set({ grayscale: v })}
        />
        <BackgroundField value={b.background} onChange={(v) => set({ background: v })} />
      </Group>
    </>
  )
}

/* ────────────────────────── معرض صور ────────────────────────── */

function GallerySettings({ settings, onChange }: { settings: Record<string, unknown>; onChange: Patch }) {
  const b = readBlock('gallery', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })

  return (
    <>
      <Group title="الصور">
        <TextField label="العنوان" value={b.title} onChange={(v) => set({ title: v })} placeholder="اختياري" />

        <ItemList
          items={b.items}
          onChange={(items) => set({ items })}
          addLabel="زوّد صورة"
          make={(id) => ({ id, image: '', caption: '', url: '' })}
          max={16}
          render={(item, patch) => (
            <>
              <ImageUpload
                label="الصورة"
                value={item.image ? [item.image] : []}
                onChange={(urls) => patch({ image: urls[0] ?? '' })}
                folder="misc"
              />
              <TextField label="التعليق" value={item.caption} onChange={(v) => patch({ caption: v })} />
              <LinkPicker label="يودّي فين" value={item.url} onChange={(v) => patch({ url: v })} />
            </>
          )}
        />
      </Group>

      <Group title="الشكل">
        <Choice
          label="طريقة العرض"
          value={b.layout}
          onChange={(v) => set({ layout: v })}
          options={[
            { value: 'grid', label: 'شبكة' },
            { value: 'masonry', label: 'شلال' },
            { value: 'strip', label: 'شريط' },
          ]}
        />
        <Choice
          label="أعمدة"
          value={b.columns}
          onChange={(v) => set({ columns: v })}
          options={[
            { value: 2, label: '٢' },
            { value: 3, label: '٣' },
            { value: 4, label: '٤' },
          ]}
        />
        <Toggle label="إظهار التعليق" checked={b.showCaption} onChange={(v) => set({ showCaption: v })} />
        <BackgroundField value={b.background} onChange={(v) => set({ background: v })} />
      </Group>
    </>
  )
}

/* ────────────────────────── نشرة بريدية ────────────────────────── */

function NewsletterSettings({ settings, onChange }: { settings: Record<string, unknown>; onChange: Patch }) {
  const b = readBlock('newsletter', settings)
  const set = (p: Partial<typeof b>) => onChange({ ...b, ...p })

  return (
    <Group title="النشرة">
      <TextField label="العنوان" value={b.heading} onChange={(v) => set({ heading: v })} />
      <TextField label="النص" value={b.text} onChange={(v) => set({ text: v })} multiline />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="نص الزر" value={b.buttonLabel} onChange={(v) => set({ buttonLabel: v })} />
        <TextField label="نص الخانة" value={b.placeholder} onChange={(v) => set({ placeholder: v })} />
      </div>
      <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
        البريد بيتسجّل في عملاء متجرك — تلاقيه في صفحة العملاء وتقدر تبعتله حملة من التسويق.
      </p>
      <BackgroundField value={b.background as BgKey} onChange={(v) => set({ background: v })} />
    </Group>
  )
}
