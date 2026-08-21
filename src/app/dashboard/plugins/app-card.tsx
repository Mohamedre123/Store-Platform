'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Check, EyeOff, HelpCircle, Settings2, X } from 'lucide-react'

/**
 * كارت تطبيق في شبكة الإضافات.
 *
 * الفكرة إن الصفحة تبقى **معرض تطبيقات** لا نموذجًا طويلًا: التاجر
 * بيبص على ١٠ إضافات ويلاقي بسرعة اللي شغّال واللي لأ، وبيفتح اللي
 * عايزه بس. النماذج المفتوحة كلها فوق بعض كانت بتخلّي الصفحة
 * تمريرًا لا نهائيًا، واللي مفعّل ما بيتميّزش عن اللي مش مفعّل.
 *
 * التفاصيل بتتفتح في نافذة: من تحت على الموبايل وفي النص على
 * الديسكتوب — عشان نموذج فيه مفتاح API وموديل ووصف يبقى ليه مساحة
 * حقيقية بدل ما يتحشر في كارت عرضه ٢٠rem.
 */
export function AppCard({
  name,
  desc,
  /** أول حرفين بيظهروا في المربّع الملوّن */
  initials,
  gradient,
  active,
  /** فيه مفتاح محفوظ حتى لو موقوف — بيغيّر نص الزرار */
  configured,
  badge,
  children,
}: {
  name: string
  desc: string
  initials: string
  gradient: string
  active: boolean
  configured: boolean
  badge?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <div className="flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-1 items-start gap-3 p-4">
          <span
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white"
            style={{ background: gradient }}
            aria-hidden="true"
          >
            {initials}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <h3 className="font-semibold">{name}</h3>
              {badge && (
                <span className="rounded-md bg-[var(--color-warning-soft)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--color-warning)]">
                  {badge}
                </span>
              )}
            </div>
            <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--fg-muted)]">
              {desc}
            </p>
          </div>

          {/* حالة التفعيل في الركن — بتتقرا من بعيد من غير قراءة نص */}
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{
              background: active ? 'var(--color-success-soft)' : 'var(--surface-2)',
              color: active ? 'var(--color-success)' : 'var(--fg-subtle)',
            }}
            title={active ? 'مفعّل' : 'مش مفعّل'}
          >
            {active ? (
              <Check className="h-4 w-4" aria-hidden="true" />
            ) : (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
        </div>

        <div className="border-t border-[var(--border)] p-3">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--surface-2)] px-3 text-sm font-medium transition-colors hover:bg-[var(--border)]"
          >
            {configured ? (
              <>
                <Settings2 className="h-3.5 w-3.5" aria-hidden="true" />
                تفاصيل التطبيق
              </>
            ) : (
              <>
                <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                اضغط هنا للتفعيل
              </>
            )}
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/50"
          />

          <div
            role="dialog"
            aria-label={`إعدادات ${name}`}
            className="relative flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-2xl bg-[var(--surface)] shadow-2xl sm:max-h-[86vh] sm:w-[min(36rem,92vw)] sm:rounded-2xl"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
              <span className="text-sm font-medium text-[var(--fg-muted)]">إعدادات التطبيق</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق"
                className="flex h-10 w-10 items-center justify-center rounded-lg text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)]"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="safe-bottom flex-1 overflow-y-auto p-4">{children}</div>
          </div>
        </div>
      )}
    </>
  )
}
