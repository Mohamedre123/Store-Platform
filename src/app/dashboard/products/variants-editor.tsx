'use client'

import { useMemo, useState } from 'react'
import { Palette, Plus, Ruler, Trash2, X } from 'lucide-react'
import { Card, Input } from '@/components/ui'
import { fromMinorUnits, toMinorUnits } from '@/lib/utils'
import { cn } from '@/lib/utils'

/**
 * محرّر المقاسات والألوان.
 *
 * ## ليه موجود
 * كل المتجر كان بيحترم الخيارات — البطاقة بتعرضها، السلة بتقف لحد
 * ما العميل يختار، والشيك أوت بيرفض السطر اللي بلا مقاس — بس ما
 * كانش فيه مكان **يتعرّف منه المقاس أصلًا**. فالتاجر اللي بيبيع
 * هدوم كان بيكتب «المقاسات: S M L» في وصف المنتج، والعميل يطلب
 * ومحدّش يعرف مقاسه، والتاجر يتصل يسأل أو يبعت بالتخمين ويترجع له.
 *
 * ## الجدول بيتولّد
 * التاجر بيكتب القيم بس؛ التركيبات (مقاس × لون) بتظهر لوحدها بسعر
 * ومخزون لكل واحدة. مطالبته إنه يكتب ستّ تركيبات بإيده معناها إنه
 * ينسى واحدة — والتركيبة الناقصة بتبان «نفدت» للعميل من غير سبب.
 *
 * ## السعر الفاضي = سعر المنتج
 * أغلب المقاسات بنفس السعر. لو ألزمناه يكتب السعر في ست خانات
 * متطابقة، أول تعديل سعر بعدين بيتعمل في خانة وينسى الباقي.
 */

export type EditorOption = {
  name: string
  displayAs: 'swatch' | 'button' | 'dropdown'
  values: Array<{ value: string; hex: string | null }>
}

export type EditorVariant = {
  values: string[]
  price: string
  stock: string
  sku: string
  isActive: boolean
}

export type VariantsPayload = {
  options: Array<{ name: string; displayAs: string; values: Array<{ value: string; hex: string | null }> }>
  variants: Array<{
    values: string[]
    price: number
    stock: number
    sku: string | null
    isActive: boolean
  }>
}

const comboKey = (values: string[]) => values.join(' / ')

/** كل التركيبات الممكنة — نفس الترتيب اللي الخادم بيولّده بيه */
function buildCombos(options: EditorOption[]): string[][] {
  const usable = options.filter((o) => o.name.trim() && o.values.length > 0)
  if (usable.length === 0) return []
  return usable.reduce<string[][]>(
    (acc, option) => acc.flatMap((row) => option.values.map((v) => [...row, v.value])),
    [[]],
  )
}

/** اقتراحات بتوفّر على التاجر الكتابة — أغلب متاجر الهدوم بتستخدمها */
const PRESETS: Array<{ label: string; icon: 'ruler' | 'palette'; option: EditorOption }> = [
  {
    label: 'مقاسات الهدوم',
    icon: 'ruler',
    option: {
      name: 'المقاس',
      displayAs: 'button',
      values: ['S', 'M', 'L', 'XL', 'XXL'].map((v) => ({ value: v, hex: null })),
    },
  },
  {
    label: 'ألوان',
    icon: 'palette',
    option: {
      name: 'اللون',
      displayAs: 'swatch',
      values: [
        { value: 'أسود', hex: '#111111' },
        { value: 'أبيض', hex: '#ffffff' },
        { value: 'بيچ', hex: '#d8c3a5' },
      ],
    },
  },
]

export function VariantsEditor({
  initialOptions,
  initialVariants,
  basePrice,
  currency,
}: {
  initialOptions: EditorOption[]
  initialVariants: EditorVariant[]
  /** سعر المنتج زي ما هو مكتوب دلوقتي — بيتستخدم كافتراضي للتركيبة */
  basePrice: string
  currency: string
}) {
  const [options, setOptions] = useState<EditorOption[]>(initialOptions)
  const [rows, setRows] = useState<Record<string, EditorVariant>>(() =>
    Object.fromEntries(initialVariants.map((v) => [comboKey(v.values), v])),
  )

  const combos = useMemo(() => buildCombos(options), [options])

  const rowFor = (combo: string[]): EditorVariant =>
    rows[comboKey(combo)] ?? { values: combo, price: '', stock: '0', sku: '', isActive: true }

  const setRow = (combo: string[], patch: Partial<EditorVariant>) =>
    setRows((prev) => {
      const k = comboKey(combo)
      return { ...prev, [k]: { ...rowFor(combo), ...patch, values: combo } }
    })

  /* الحمولة بتتبعت كنص في خانة مخفية — نفس أسلوب الصور في النموذج ده */
  const payload: VariantsPayload = {
    options: options
      .filter((o) => o.name.trim() && o.values.length > 0)
      .map((o) => ({ name: o.name.trim(), displayAs: o.displayAs, values: o.values })),
    variants: combos.map((combo) => {
      const row = rowFor(combo)
      return {
        values: combo,
        price: row.price.trim() ? toMinorUnits(row.price) : toMinorUnits(basePrice || '0'),
        stock: Math.max(0, Math.trunc(Number(row.stock) || 0)),
        sku: row.sku.trim() || null,
        isActive: row.isActive,
      }
    }),
  }

  const totalStock = combos.reduce((n, c) => n + (Number(rowFor(c).stock) || 0), 0)

  function addOption(preset?: EditorOption) {
    setOptions((prev) => [
      ...prev,
      preset ? { ...preset, values: [...preset.values] } : { name: '', displayAs: 'button', values: [] },
    ])
  }

  function updateOption(index: number, patch: Partial<EditorOption>) {
    setOptions((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)))
  }

  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index))
  }

  function addValue(index: number, raw: string) {
    const value = raw.trim()
    if (!value) return
    setOptions((prev) =>
      prev.map((o, i) =>
        i === index && !o.values.some((v) => v.value === value)
          ? { ...o, values: [...o.values, { value, hex: o.displayAs === 'swatch' ? '#cccccc' : null }] }
          : o,
      ),
    )
  }

  function removeValue(index: number, value: string) {
    setOptions((prev) =>
      prev.map((o, i) => (i === index ? { ...o, values: o.values.filter((v) => v.value !== value) } : o)),
    )
  }

  return (
    /*
      `min-w-0` على البطاقة نفسها.

      جدول التركيبات أعرض من الفون عن قصد — بيتمرّر جوّه غلافه. بس
      البطاقة عنصر شبكة، وعرضها الأدنى الافتراضي `auto` بيخلّيها
      تتمدّد لعرض الجدول بدل ما تسيبه يتمرّر — فالصفحة كلها كانت
      بتتزحلق، والغلاف اللي بيمرّر ما كانش بيمرّر حاجة.
    */
    <Card className="flex min-w-0 flex-col gap-5 p-5">
      <input type="hidden" name="variants" value={JSON.stringify(payload)} />

      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">المقاسات والألوان</h2>
        <p className="text-sm text-[var(--fg-muted)]">
          لو المنتج ليه مقاسات أو ألوان، ضيفها هنا. العميل مش هيقدر يكمّل الطلب من غير ما يحدّدها،
          وهتوصلك مكتوبة في الطلب.
        </p>
      </div>

      {options.length === 0 && (
        <div className="flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => addOption(p.option)}
              className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
            >
              {p.icon === 'ruler' ? (
                <Ruler className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Palette className="h-4 w-4" aria-hidden="true" />
              )}
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => addOption()}
            className="flex min-h-10 items-center gap-2 rounded-lg border border-[var(--border-strong)] px-3 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            خيار من عندي
          </button>
        </div>
      )}

      {options.map((option, i) => (
        <OptionEditor
          key={i}
          option={option}
          onChange={(patch) => updateOption(i, patch)}
          onRemove={() => removeOption(i)}
          onAddValue={(v) => addValue(i, v)}
          onRemoveValue={(v) => removeValue(i, v)}
        />
      ))}

      {options.length > 0 && options.length < 3 && (
        <button
          type="button"
          onClick={() => addOption()}
          className="flex min-h-10 items-center justify-center gap-2 self-start rounded-lg border border-dashed border-[var(--border-strong)] px-3 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          خيار تاني
        </button>
      )}

      {combos.length > 0 && (
        <div className="flex flex-col gap-3 border-t border-[var(--border)] pt-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold">
              التركيبات <span className="tabular text-[var(--fg-subtle)]">({combos.length})</span>
            </h3>
            <span className="tabular text-xs text-[var(--fg-subtle)]">
              إجمالي الكمية: {totalStock}
            </span>
          </div>

          <p className="text-xs text-[var(--fg-subtle)]">
            سيب السعر فاضي والتركيبة تاخد سعر المنتج. شيل علامة «متاح» عن التركيبة اللي مش
            بتبيعها.
          </p>

          {/*
            الجدول بيتمدّد أفقيًا لوحده على الفون.
            ست تركيبات × أربع خانات ما بتدخلش في ٣٦٠ بكسل، ولو سبناها
            تتلوى، التاجر بيحط سعر في خانة الكمية.
          */}
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-[34rem] text-sm">
              <thead>
                <tr className="text-xs text-[var(--fg-subtle)]">
                  <th scope="col" className="pb-2 text-start font-medium">
                    التركيبة
                  </th>
                  <th scope="col" className="pb-2 text-start font-medium">
                    السعر ({currency})
                  </th>
                  <th scope="col" className="pb-2 text-start font-medium">
                    الكمية
                  </th>
                  <th scope="col" className="pb-2 text-start font-medium">
                    كود المنتج
                  </th>
                  <th scope="col" className="pb-2 text-center font-medium">
                    متاح
                  </th>
                </tr>
              </thead>
              <tbody>
                {combos.map((combo) => {
                  const row = rowFor(combo)
                  return (
                    <tr key={comboKey(combo)} className="border-t border-[var(--border)]">
                      <td className="py-2 pe-3 font-medium whitespace-nowrap">{comboKey(combo)}</td>
                      <td className="py-2 pe-3">
                        <Input
                          value={row.price}
                          onChange={(e) => setRow(combo, { price: e.target.value })}
                          inputMode="decimal"
                          placeholder={basePrice || '—'}
                          aria-label={`سعر ${comboKey(combo)}`}
                          className="h-10 w-24"
                        />
                      </td>
                      <td className="py-2 pe-3">
                        <Input
                          value={row.stock}
                          onChange={(e) => setRow(combo, { stock: e.target.value })}
                          inputMode="numeric"
                          aria-label={`كمية ${comboKey(combo)}`}
                          className="h-10 w-20"
                        />
                      </td>
                      <td className="py-2 pe-3">
                        <Input
                          value={row.sku}
                          onChange={(e) => setRow(combo, { sku: e.target.value })}
                          dir="ltr"
                          aria-label={`كود ${comboKey(combo)}`}
                          className="h-10 w-28"
                        />
                      </td>
                      <td className="py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.isActive}
                          onChange={(e) => setRow(combo, { isActive: e.target.checked })}
                          aria-label={`${comboKey(combo)} متاح`}
                          className="h-5 w-5 accent-[var(--primary)]"
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-[var(--fg-subtle)]">
            الكمية هنا بتغلب كمية المنتج العامة — كل مقاس بيتخصم من رصيده هو.
          </p>
        </div>
      )}
    </Card>
  )
}

/** خيار واحد: اسمه، شكله، وقيمه */
function OptionEditor({
  option,
  onChange,
  onRemove,
  onAddValue,
  onRemoveValue,
}: {
  option: EditorOption
  onChange: (patch: Partial<EditorOption>) => void
  onRemove: () => void
  onAddValue: (value: string) => void
  onRemoveValue: (value: string) => void
}) {
  const [draft, setDraft] = useState('')

  function commit() {
    /*
      الفاصلة بتفصل: التاجر بيلزق «S, M, L» من مكان تاني، ولو
      اتعاملت كقيمة واحدة بيلاقي مقاسًا اسمه «S, M, L».
    */
    for (const part of draft.split(/[,،\n]/)) onAddValue(part)
    setDraft('')
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-[var(--border)] p-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex min-w-40 flex-1 flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--fg-muted)]">اسم الخيار</span>
          <Input
            value={option.name}
            onChange={(e) => onChange({ name: e.target.value })}
            placeholder="المقاس"
            className="h-10"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-medium text-[var(--fg-muted)]">شكل العرض</span>
          <select
            value={option.displayAs}
            onChange={(e) => onChange({ displayAs: e.target.value as EditorOption['displayAs'] })}
            className="h-10 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2 text-sm outline-none focus:border-[var(--primary)]"
          >
            <option value="button">أزرار</option>
            <option value="swatch">دوائر ألوان</option>
            <option value="dropdown">قايمة منسدلة</option>
          </select>
        </label>

        <button
          type="button"
          onClick={onRemove}
          aria-label={`حذف خيار ${option.name || 'بدون اسم'}`}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--color-danger)] transition-colors hover:bg-[var(--surface-2)]"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {option.values.map((v) => (
          <span
            key={v.value}
            className={cn(
              'flex min-h-9 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] ps-2.5 pe-1 text-sm',
            )}
          >
            {option.displayAs === 'swatch' && (
              /* اللون بيتظبط من هنا — العميل بيشوف الدايرة دي على المنتج */
              <input
                type="color"
                value={v.hex ?? '#cccccc'}
                onChange={(e) =>
                  onChange({
                    values: option.values.map((x) =>
                      x.value === v.value ? { ...x, hex: e.target.value } : x,
                    ),
                  })
                }
                aria-label={`لون ${v.value}`}
                className="h-5 w-5 cursor-pointer rounded-full border-0 bg-transparent p-0"
              />
            )}
            {v.value}
            <button
              type="button"
              onClick={() => onRemoveValue(v.value)}
              aria-label={`حذف ${v.value}`}
              className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--fg-subtle)] transition-colors hover:bg-[var(--surface-2)]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>

      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              /* النموذج جوّه form — Enter من غير المنع ده بيحفظ المنتج */
              e.preventDefault()
              commit()
            }
          }}
          onBlur={commit}
          placeholder="اكتب القيمة واضغط Enter — أو الزقهم بفاصلة"
          aria-label={`قيمة جديدة لـ${option.name || 'الخيار'}`}
          className="h-10 flex-1"
        />
        <button
          type="button"
          onClick={commit}
          disabled={!draft.trim()}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-lg border border-[var(--border-strong)] px-3 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] disabled:opacity-45"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          ضيف
        </button>
      </div>
    </div>
  )
}
