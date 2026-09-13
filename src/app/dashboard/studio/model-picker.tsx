'use client'

import { useEffect, useState } from 'react'
import { AI_PROVIDERS, type AiProvider } from '@/lib/ai/providers-meta'
import { listAiModelsAction, type ModelsState } from './actions'

/**
 * اختيار الموديل يدوي — للاستوديو ولكل جدول نشر.
 *
 * «الافتراضي» (فاضي) يعني اللي مختاره في صفحة الإضافات. الاختيار هنا
 * ما بيغيّرش الإضافات — بيتطبّق على الطلب ده أو الجدول ده بس.
 *
 * ولو الموديل المختار وقع عند جوجل، البديل بيتجرّب للمرة دي بس
 * واختيارك بيفضل زي ما هو.
 */
export function AiModelPicker({
  provider,
  textModel,
  imageModel,
  showImage = true,
  onChange,
}: {
  /** فاضي = المزوّد الافتراضي */
  provider: AiProvider | null
  textModel: string
  imageModel: string
  showImage?: boolean
  onChange: (next: { textModel: string; imageModel: string }) => void
}) {
  const [state, setState] = useState<ModelsState | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadedFor, setLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    const key = provider ?? 'default'
    if (loadedFor === key) return
    setLoading(true)
    void listAiModelsAction({ provider }).then((res) => {
      setLoading(false)
      setState(res)
      setLoadedFor(key)
      /* موديل مزوّد تاني ما ينفعش يفضل مختار بعد تغيير المزوّد */
      if (res.ok) {
        const fitsText = !textModel || res.text.some((m) => m.id === textModel)
        const fitsImage = !imageModel || res.image.some((m) => m.id === imageModel)
        if (!fitsText || !fitsImage) {
          onChange({ textModel: fitsText ? textModel : '', imageModel: fitsImage ? imageModel : '' })
        }
      }
    })
  }, [provider])

  const label = state?.ok ? (AI_PROVIDERS.find((p) => p.key === state.provider)?.label ?? state.provider) : ''

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-[var(--fg-muted)]">
        الموديل{label ? ` · ${label}` : ''}
        {loading && <span className="ms-2 text-[var(--fg-subtle)]">بنجيب القايمة…</span>}
      </span>

      {state && !state.ok ? (
        <p className="text-xs text-[var(--color-danger)]">{state.error}</p>
      ) : (
        <div className={showImage ? 'grid gap-2 sm:grid-cols-2' : 'grid gap-2'}>
          <Select
            label="الكلام"
            value={textModel}
            models={state?.ok ? state.text : []}
            fallback={state?.ok ? state.defaultText : null}
            onChange={(v) => onChange({ textModel: v, imageModel })}
          />
          {showImage && (
            <Select
              label="الصور"
              value={imageModel}
              models={state?.ok ? state.image : []}
              fallback={state?.ok ? state.defaultImage : null}
              autoText="تلقائي — أول موديل صور شغّال"
              onChange={(v) => onChange({ textModel, imageModel: v })}
            />
          )}
        </div>
      )}
    </div>
  )
}

function Select({
  label,
  value,
  models,
  fallback,
  autoText = 'تلقائي',
  onChange,
}: {
  label: string
  value: string
  models: Array<{ id: string; label: string }>
  /** افتراضي الإضافات */
  fallback: string | null
  autoText?: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-[var(--fg-subtle)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-10 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 text-sm focus:border-[var(--primary)] focus:outline-none"
      >
        <option value="">{fallback ? `الافتراضي — ${fallback}` : autoText}</option>
        {value && !models.some((m) => m.id === value) && <option value={value}>{value}</option>}
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  )
}
