'use client'

import { useEffect, useState } from 'react'
import type { AiProvider } from '@/lib/ai/providers-meta'
import { listSavedModelsAction } from './ai-actions'

type Model = { id: string; label: string }
type Lists = { text: Model[]; image: Model[]; error?: string }

export type ModelValues = {
  model: string
  imageModel: string
  openaiModel: string
  openaiImageModel: string
}

/**
 * الموديلات الافتراضية — للكلام وللصور، لكل مفتاح.
 *
 * ## القايمة من المفتاح المحفوظ على طول
 * كانت القايمة بتظهر بس بعد «تحقّق» على مفتاح جديد — فالتاجر اللي
 * مفتاحه محفوظ من زمان ما كانش شايف غير اسم الموديل الحالي ومش عارف
 * يغيّره. دلوقتي بتتجاب من جوجل أو OpenAI أول ما الكارت يتفتح.
 *
 * ## والصور ليها اختيارها
 * الصور كانت بتاخد أحدث موديل تلقائيًا، والأحدث غالبًا معاينة واقفة
 * عند جوجل — فالنشر التلقائي بيقف والتاجر مش قادر يعمل حاجة. الاختيار
 * ده بيتطبّق على الاستوديو والنشر التلقائي، إلا لو اتغيّر هناك يدوي.
 */
export function ModelDefaults({
  slug,
  hasGemini,
  hasOpenai,
  geminiKey,
  openaiKey,
  verified,
  values,
  onChange,
}: {
  slug: 'gemini' | 'gemini_pro'
  hasGemini: boolean
  hasOpenai: boolean
  /** مفتاح لسه متحقّق منه ومش محفوظ — القايمة بتتجاب بيه */
  geminiKey?: string
  openaiKey?: string
  /** اللي رجع من «تحقّق» — بيظهر فورًا لحد ما القايمة الكاملة توصل */
  verified: { gemini: Model[]; openai: Model[] }
  values: ModelValues
  onChange: (next: Partial<ModelValues>) => void
}) {
  const [lists, setLists] = useState<Partial<Record<AiProvider, Lists>>>({})
  const [loading, setLoading] = useState<Partial<Record<AiProvider, boolean>>>({})

  const load = (provider: AiProvider, apiKey?: string) => {
    setLoading((l) => ({ ...l, [provider]: true }))
    void listSavedModelsAction({ slug, provider, apiKey: apiKey || undefined }).then((res) => {
      setLoading((l) => ({ ...l, [provider]: false }))
      setLists((s) => ({
        ...s,
        [provider]: res.ok ? { text: res.text, image: res.image } : { text: [], image: [], error: res.error },
      }))
    })
  }

  useEffect(() => {
    if (hasGemini) load('gemini', geminiKey)
  }, [hasGemini, verified.gemini.length])

  useEffect(() => {
    if (hasOpenai) load('openai', openaiKey)
  }, [hasOpenai, verified.openai.length])

  if (!hasGemini && !hasOpenai) return null

  const rows: Array<{
    provider: AiProvider
    title: string
    text: keyof ModelValues
    image: keyof ModelValues
    hint: string
  }> = []
  if (hasGemini)
    rows.push({
      provider: 'gemini',
      title: 'Gemini',
      text: 'model',
      image: 'imageModel',
      hint: 'اللي فيه «Flash» أسرع وأرخص. الموديلات اللي فيها «preview» تجريبية وممكن تقف عند جوجل.',
    })
  if (hasOpenai)
    rows.push({
      provider: 'openai',
      title: 'ChatGPT',
      text: 'openaiModel',
      image: 'openaiImageModel',
      hint: 'اللي فيه «mini» أسرع وأرخص.',
    })

  return (
    <div className="flex flex-col gap-4">
      {rows.map((row) => {
        const got = lists[row.provider]
        const textModels = got?.text.length ? got.text : verified[row.provider]
        return (
          <div key={row.provider} className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">موديلات {row.title} الافتراضية</span>
              {loading[row.provider] && <span className="text-xs text-[var(--fg-subtle)]">بنجيب القايمة…</span>}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Picker
                label="للكلام والمساعد"
                value={values[row.text]}
                models={textModels}
                autoLabel="تلقائي"
                onChange={(v) => onChange({ [row.text]: v })}
              />
              <Picker
                label="للصور (الاستوديو والنشر التلقائي)"
                value={values[row.image]}
                models={got?.image ?? []}
                autoLabel="تلقائي — أول موديل صور شغّال"
                onChange={(v) => onChange({ [row.image]: v })}
              />
            </div>
            {got?.error ? (
              <span className="text-xs text-[var(--color-danger)]">{got.error}</span>
            ) : (
              <span className="text-xs text-[var(--fg-subtle)]">{row.hint}</span>
            )}
          </div>
        )
      })}
      <p className="text-xs leading-relaxed text-[var(--fg-subtle)]">
        الاختيار ده بيتطبّق على كل حاجة. وتقدر تغيّره لمرة واحدة من الاستوديو أو لكل جدول في النشر التلقائي — من غير ما
        يتغيّر هنا.
      </p>
    </div>
  )
}

function Picker({
  label,
  value,
  models,
  autoLabel,
  onChange,
}: {
  label: string
  value: string
  models: Model[]
  autoLabel: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--fg-muted)]">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
      >
        <option value="">{autoLabel}</option>
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
