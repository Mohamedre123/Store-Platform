'use client'

import { useMemo, useState } from 'react'
import type { CardOption, CardVariant } from '@/lib/product-options'

/**
 * اختيار الخيارات في مساحة ضيّقة — على بطاقة المنتج أو جوّه السلة.
 *
 * مش نسخة مصغّرة من `VariantPicker` بتاع صفحة المنتج: ده بيشتغل في
 * مكان فيه عشر بطاقات جنب بعض، فلازم يكون مضغوطًا ومقروءًا في نفس
 * الوقت.
 *
 * القاعدة اللي مشتركة بين الاتنين: **القيمة اللي نفدت بتتعطّل مش
 * بتتخفي.** العميل لازم يعرف إن المقاس ده موجود بس خلصان — إخفاؤه
 * بيخلّيه يفتكر إن المتجر ما بيبيعوش أصلًا ويسيب.
 */

export function useVariantChoice(options: CardOption[], variants: CardVariant[]) {
  /* بنبدأ من أول تركيبة متاحة — فالإضافة بتفضل ضغطة واحدة لأغلب العملاء */
  const first = useMemo(
    () => variants.find((v) => v.stock > 0) ?? variants[0],
    [variants],
  )

  const [picked, setPicked] = useState<string[]>(first?.optionValueIds ?? [])

  const selected = useMemo(() => {
    if (picked.length !== options.length || picked.some((v) => !v)) return null
    return (
      variants.find(
        (v) =>
          v.optionValueIds.length === picked.length &&
          picked.every((id) => v.optionValueIds.includes(id)),
      ) ?? null
    )
  }, [picked, variants, options.length])

  /** فيه تركيبة متاحة لو اخترنا القيمة دي؟ */
  const available = (optionIndex: number, valueId: string) => {
    const trial = [...picked]
    trial[optionIndex] = valueId
    return variants.some(
      (v) => v.stock > 0 && trial.every((id) => !id || v.optionValueIds.includes(id)),
    )
  }

  const pick = (optionIndex: number, valueId: string) =>
    setPicked((prev) => {
      const next = [...prev]
      next[optionIndex] = valueId
      return next
    })

  return { picked, pick, selected, available }
}

export function OptionChips({
  options,
  picked,
  pick,
  available,
  /** يخفي اسم الخيار — للمساحات الضيّقة أوي */
  bare,
}: {
  options: CardOption[]
  picked: string[]
  pick: (optionIndex: number, valueId: string) => void
  available: (optionIndex: number, valueId: string) => boolean
  bare?: boolean
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((option, i) => {
        const chosen = option.values.find((v) => v.id === picked[i])

        return (
          <div key={option.id} className="flex flex-col gap-1">
            {!bare && (
              <span className="text-xs opacity-60">
                {option.name}
                {chosen && <span className="font-medium opacity-100"> — {chosen.value}</span>}
              </span>
            )}

            {/*
              القايمة المنسدلة للخيار اللي قيمه كتير: عشرين مقاس على
              بطاقة بيطوّلوها لدرجة إن المنتج اللي تحتها ما يبانش.
            */}
            {option.displayAs === 'dropdown' || option.values.length > 6 ? (
              <select
                value={picked[i] ?? ''}
                onChange={(e) => pick(i, e.target.value)}
                aria-label={option.name}
                className="h-9 w-full rounded-[var(--sf-radius)] border border-[var(--sf-text)]/20 bg-[var(--sf-surface)] px-2 text-xs outline-none focus:border-[var(--sf-primary)]"
              >
                <option value="">{option.name}</option>
                {option.values.map((v) => (
                  <option key={v.id} value={v.id} disabled={!available(i, v.id)}>
                    {v.value}
                    {available(i, v.id) ? '' : ' — نفد'}
                  </option>
                ))}
              </select>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {option.values.map((value) => {
                  const active = picked[i] === value.id
                  const ok = available(i, value.id)

                  if (option.displayAs === 'swatch' && value.hex) {
                    return (
                      <button
                        key={value.id}
                        type="button"
                        onClick={() => pick(i, value.id)}
                        disabled={!ok}
                        aria-label={value.value}
                        aria-pressed={active}
                        title={ok ? value.value : `${value.value} — نفد`}
                        className={`h-7 w-7 rounded-full border-2 transition-transform ${
                          active ? 'scale-110 border-[var(--sf-primary)]' : 'border-[var(--sf-text)]/20'
                        } ${ok ? '' : 'opacity-35'}`}
                        style={{ background: value.hex }}
                      />
                    )
                  }

                  return (
                    <button
                      key={value.id}
                      type="button"
                      onClick={() => pick(i, value.id)}
                      disabled={!ok}
                      aria-pressed={active}
                      className={`min-h-8 rounded-[var(--sf-radius)] border px-2.5 text-xs font-medium transition-colors ${
                        active
                          ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/10 text-[var(--sf-primary)]'
                          : 'border-[var(--sf-text)]/20 hover:border-[var(--sf-text)]/45'
                      } ${ok ? '' : 'cursor-not-allowed line-through opacity-40'}`}
                    >
                      {value.value}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
