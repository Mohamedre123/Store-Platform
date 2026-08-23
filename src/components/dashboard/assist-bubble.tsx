'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { Check, Copy, Loader2, Sparkles, TriangleAlert, Wand2, X } from 'lucide-react'
import { assistAskAction } from '@/app/dashboard/assist-actions'

/**
 * المساعد في مكانه — «حدّد واسأل».
 *
 * التاجر بيحدّد أي نص في اللوحة بالماوس (أو بالضغط المطوّل على
 * الموبايل)، فتطلع فقاعة صغيرة جنب التحديد. يكتب اللي عايزه —
 * «خلّيه أقصر»، «صلّح الإملاء»، «اكتبه بشكل تسويقي» — وياخد الناتج
 * جاهز للنسخ.
 *
 * ليه ده أهم من الشات؟ لأن الشات بيطلب من التاجر يشرح إنه واقف
 * فين وبيتكلم عن إيه. هنا هو **واقف على الحاجة نفسها** — التحديد
 * هو السياق، والكتابة هي الطلب، وخلاص.
 *
 * تلات قرارات:
 *
 * ١. **ما بتظهرش جوّه حقول الكتابة.** لو ظهرت وهو بيحدّد كلمة عشان
 *    يمسحها، بتغطّي عليه وبتوقّف شغله. التحديد اللي جوّه input أو
 *    textarea بيتتجاهل.
 * ٢. **ما بتكتبش مكانه.** بترجّع الناتج وهو بينسخه. الكتابة
 *    التلقائية في حقل كان ممكن تمسح شغله من غير رجعة.
 * ٣. **بتقفل مع أول تمرير أو ضغطة برّه.** الفقاعة اللي بتفضل
 *    معلّقة على الشاشة بتتحوّل لزحمة.
 */
export function AssistBubble({ pageLabel }: { pageLabel?: string }) {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null)
  const [selection, setSelection] = useState('')
  const [open, setOpen] = useState(false)
  const [instruction, setInstruction] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [pending, start] = useTransition()

  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  /* التقاط التحديد */
  useEffect(() => {
    const onUp = (e: MouseEvent | TouchEvent) => {
      // الضغط جوّه الفقاعة نفسها مش تحديد جديد
      if (boxRef.current?.contains(e.target as Node)) return

      const sel = window.getSelection()
      const text = sel?.toString().trim() ?? ''

      if (!text || text.length < 2) {
        if (!open) setAnchor(null)
        return
      }

      /*
        التحديد جوّه حقل كتابة بيتتجاهل: التاجر بيحدّد عشان يمسح أو
        يستبدل، والفقاعة فوق الحقل بتوقّفه.
      */
      const node = sel?.anchorNode
      const el = (node?.nodeType === 3 ? node.parentElement : (node as Element | null)) ?? null
      if (el?.closest('input, textarea, [contenteditable="true"]')) return

      const rect = sel?.getRangeAt(0).getBoundingClientRect()
      if (!rect || rect.width === 0) return

      setSelection(text.slice(0, 4000))
      setAnchor({ x: rect.left + rect.width / 2, y: rect.bottom })
      setResult(null)
      setError(null)
    }

    document.addEventListener('mouseup', onUp)
    document.addEventListener('touchend', onUp)
    return () => {
      document.removeEventListener('mouseup', onUp)
      document.removeEventListener('touchend', onUp)
    }
  }, [open])

  /* القفل مع التمرير أو Escape */
  useEffect(() => {
    if (!anchor) return

    const close = () => {
      setAnchor(null)
      setOpen(false)
      setResult(null)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }

    window.addEventListener('scroll', close, { passive: true, once: true })
    document.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [anchor])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  if (!anchor) return null

  const ask = () => {
    const text = instruction.trim()
    if (!text || pending) return

    start(async () => {
      setError(null)
      setResult(null)
      const res = await assistAskAction({ selection, instruction: text, page: pageLabel })
      if (res.ok) setResult(res.text)
      else setError(res.error)
    })
  }

  /*
    الفقاعة داخل حدود الشاشة: التحديد على حرف الشاشة كان بيخلّيها
    تخرج برّه ونصّها ما يبانش — وعلى الموبايل ده بيحصل كل شوية.
  */
  const width = open ? 320 : 132
  const left = Math.min(Math.max(anchor.x - width / 2, 8), window.innerWidth - width - 8)
  const top = Math.min(anchor.y + 8, window.innerHeight - 80)

  return (
    <div
      ref={boxRef}
      className="zw-assist-pop fixed z-[60]"
      style={{ left, top, width }}
      role="dialog"
      aria-label="مساعد سريع"
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full bg-gradient-to-br from-[#8b5cf6] to-[#ec4899] px-4 text-sm font-semibold text-white shadow-xl ring-1 ring-white/20"
        >
          <Sparkles className="h-4 w-4" aria-hidden="true" />
          مساعدة
        </button>
      ) : (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl">
          <header className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2">
            <Wand2 className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate text-xs text-[var(--fg-muted)]">
              {selection.slice(0, 60)}
            </span>
            <button
              type="button"
              onClick={() => {
                setAnchor(null)
                setOpen(false)
              }}
              aria-label="إغلاق"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </header>

          <div className="flex flex-col gap-2 p-3">
            <div className="flex gap-1.5">
              <input
                ref={inputRef}
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') ask()
                }}
                placeholder="عايز تعمل فيه إيه؟"
                className="min-h-10 min-w-0 flex-1 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-2.5 text-sm focus:border-[var(--primary)] focus:outline-none"
              />
              <button
                type="button"
                onClick={ask}
                disabled={pending || !instruction.trim()}
                aria-label="نفّذ"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--primary)] text-[var(--primary-fg)] disabled:opacity-50"
              >
                {pending ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
            </div>

            {/* اقتراحات جاهزة — أسرع من الكتابة، وبتقول للتاجر ده بيعمل إيه */}
            {!result && !pending && (
              <div className="flex flex-wrap gap-1">
                {['خلّيه أقصر', 'صلّح الإملاء', 'اكتبه تسويقي', 'ترجمه إنجليزي'].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setInstruction(s)
                      setTimeout(ask, 0)
                    }}
                    className="rounded-md bg-[var(--surface-2)] px-2 py-1 text-[11px] text-[var(--fg-muted)] transition-colors hover:bg-[var(--border)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <p className="flex items-start gap-1.5 rounded-lg bg-[var(--color-danger-soft)] px-2.5 py-2 text-xs text-[var(--color-danger)]">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>{error}</span>
              </p>
            )}

            {result && (
              <div className="flex flex-col gap-2">
                <p className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-lg bg-[var(--surface-2)] px-2.5 py-2 text-sm leading-relaxed">
                  {result}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(result)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1800)
                  }}
                  className="flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-[var(--primary)] text-sm font-medium text-[var(--primary-fg)]"
                >
                  {copied ? (
                    <>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      اتنسخ
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                      انسخ الناتج
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
