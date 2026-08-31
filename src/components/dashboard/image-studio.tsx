'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { Check, ImagePlus, Loader2, Sparkles, TriangleAlert, Wand2, X } from 'lucide-react'
import { assistImageAction, listImageModelsAction } from '@/app/dashboard/assist-actions'
import { Portal } from '@/components/ui/portal'

/**
 * تعديل صور المنتجات بالوصف.
 *
 * **في المنتجات بس** عن قصد. ده المكان اللي التعديل فيه بيفرق في
 * البيع: خلفية بيضا نضيفة، شيل حاجة من الكادر، إضاءة أوضح. صورة
 * المنتج الوحشة بتقلّل التحويل أكتر من أي حاجة تانية في الصفحة،
 * والتاجر الصغير مالوش استوديو.
 *
 * قراران:
 *
 * ١. **الناتج بيتعرض جنب الأصل وما بيستبدلوش.** التاجر بيشوف
 *    الاتنين ويقرّر. الاستبدال المباشر كان هيضيّع صورة أصلية
 *    محصلش ليها نسخة تانية.
 * ٢. **بنقول إن كل تعديل بيتحاسب على مفتاحه.** توليد الصور أغلى من
 *    النص بكتير، والتاجر اللي بيجرّب عشرين مرة من غير ما يعرف
 *    بيتفاجئ بالفاتورة.
 */
export function ImageStudio({
  sourceUrl,
  onApply,
  onClose,
}: {
  /** الصورة اللي بيعدّلها — فاضية يعني توليد من الصفر */
  sourceUrl?: string | null
  onApply: (url: string) => void
  onClose: () => void
}) {
  const [instruction, setInstruction] = useState('')
  const [models, setModels] = useState<Array<{ id: string; label: string }>>([])
  const [model, setModel] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  /**
   * صورة مرجعية بيرفعها التاجر هنا على طول.
   *
   * مش كل تاجر عنده صورة كويسة في المتجر يبني عليها — واحد مصوّر
   * منتجه بالموبايل على السرير وعايز نفس المنتج بشكل احترافي.
   * الرفع من جوّه الاستوديو بيوفّر عليه إنه يضيف الصورة الوحشة
   * للمنتج الأول عشان يقدر يعدّلها.
   */
  const [uploaded, setUploaded] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  /* الصورة اللي هيشتغل عليها: المرفوعة تغلب لأنها أحدث اختيار */
  const base = uploaded ?? sourceUrl ?? null

  const pickFile = async (file: File) => {
    setError(null)
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      body.append('folder', 'products')
      const res = await fetch('/api/upload', { method: 'POST', body })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) setUploaded(data.url)
      else setError(data.error ?? 'فشل رفع الصورة')
    } catch {
      setError('مشكلة في الاتصال. جرّب تاني.')
    } finally {
      setUploading(false)
    }
  }

  useEffect(() => {
    void listImageModelsAction().then((res) => {
      if (res.ok) {
        setModels(res.models)
        setModel((m) => m || res.models[0]?.id || '')
      } else {
        setError(res.error)
      }
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const run = () => {
    const text = instruction.trim()
    if (!text || pending) return

    start(async () => {
      setError(null)
      setResult(null)
      const res = await assistImageAction({
        sourceUrl: base || undefined,
        instruction: text,
        model: model || undefined,
      })
      if (res.ok) setResult(res.url)
      else setError(res.error)
    })
  }

  const presets = base
    ? ['خلفية بيضا نضيفة', 'إضاءة أوضح وألوان أنقى', 'شيل اللي ورا المنتج', 'خلّيها مربّعة للمتجر']
    : ['صورة منتج على خلفية بيضا', 'صورة أجواء دافية للمنتج']

  return (
    <Portal>
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        aria-label="إغلاق"
        onClick={onClose}
        className="absolute inset-0 bg-black/55"
      />

      <div
        role="dialog"
        aria-label="تعديل الصورة بالذكاء الاصطناعي"
        className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] shadow-2xl sm:max-h-[88vh] sm:w-[min(46rem,94vw)] sm:rounded-2xl"
      >
        <header className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] text-white">
            <Wand2 className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold">{base ? 'عدّل الصورة' : 'ولّد صورة'}</h3>
            <p className="text-xs text-[var(--fg-subtle)]">
              بمفتاح Gemini بتاعك — كل تعديل بيتحاسب على حسابك.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="safe-bottom flex-1 overflow-y-auto p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <figure className="flex flex-col gap-1.5">
              <figcaption className="flex items-center justify-between gap-2 text-xs font-medium text-[var(--fg-muted)]">
                <span>{base ? 'الأصلية' : 'صورة مرجعية (اختياري)'}</span>
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="text-[var(--primary)] hover:underline"
                >
                  {base ? 'غيّرها' : 'ارفع صورة'}
                </button>
              </figcaption>

              <button
                type="button"
                onClick={() => !base && fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  const f = e.dataTransfer.files?.[0]
                  if (f) void pickFile(f)
                }}
                className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)]"
              >
                {uploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" aria-hidden="true" />
                ) : base ? (
                  <Image src={base} alt="" fill sizes="(max-width: 640px) 90vw, 22rem" className="object-contain" />
                ) : (
                  <span className="flex flex-col items-center gap-2 px-4 text-center text-sm text-[var(--fg-subtle)]">
                    <ImagePlus className="h-6 w-6" aria-hidden="true" />
                    ارفع صورة منتجك عشان يشتغل عليها — أو سيبها فاضية ويولّد من الوصف
                  </span>
                )}
              </button>

              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/avif"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (f) void pickFile(f)
                  e.target.value = ''
                }}
              />
            </figure>

            <figure className="flex flex-col gap-1.5">
              <figcaption className="text-xs font-medium text-[var(--fg-muted)]">الناتج</figcaption>
              <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-[var(--radius-card)] border border-dashed border-[var(--border-strong)] bg-[var(--surface-2)]">
                {pending ? (
                  <span className="flex flex-col items-center gap-2 text-sm text-[var(--fg-muted)]">
                    <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
                    بيشتغل عليها…
                  </span>
                ) : result ? (
                  <Image src={result} alt="" fill sizes="(max-width: 640px) 90vw, 22rem" className="object-contain" />
                ) : (
                  <span className="px-4 text-center text-sm text-[var(--fg-subtle)]">
                    اكتب اللي عايزه تحت وهيظهر هنا
                  </span>
                )}
              </span>
            </figure>
          </div>

          <div className="mt-4 flex flex-col gap-3">
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setInstruction(p)}
                  className="min-h-9 rounded-lg bg-[var(--surface-2)] px-3 text-xs text-[var(--fg-muted)] transition-colors hover:bg-[var(--border)]"
                >
                  {p}
                </button>
              ))}
            </div>

            <textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              placeholder="اوصف التعديل اللي عايزه…"
              className="w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2.5 text-sm leading-relaxed focus:border-[var(--primary)] focus:outline-none"
            />

            {models.length > 1 && (
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-[var(--fg-muted)]">موديل الصور</span>
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="min-h-11 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm focus:border-[var(--primary)] focus:outline-none"
                >
                  {models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </label>
            )}

            {error && (
              <p className="flex items-start gap-2 rounded-lg bg-[var(--color-danger-soft)] px-3 py-2 text-sm text-[var(--color-danger)]">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}
          </div>
        </div>

        <footer className="safe-bottom flex shrink-0 gap-2 border-t border-[var(--border)] p-4">
          <button
            type="button"
            onClick={run}
            disabled={pending || uploading || !instruction.trim()}
            className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-[var(--primary)] px-4 text-sm font-semibold text-[var(--primary-fg)] disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            {pending ? 'بيشتغل…' : result ? 'جرّب تاني' : 'نفّذ'}
          </button>

          {result && (
            <button
              type="button"
              onClick={() => onApply(result)}
              className="flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[var(--color-success)] px-4 text-sm font-semibold text-white"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              استخدمها
            </button>
          )}
        </footer>
      </div>
    </div>
    </Portal>
  )
}
