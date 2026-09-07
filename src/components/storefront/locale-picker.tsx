'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown, Languages } from 'lucide-react'
import { chooseLocaleAction } from '@/app/s/[store]/locale-actions'
import { LOCALE_META, type Locale } from '@/lib/i18n'
import { useT } from './locale'
import { cn } from '@/lib/utils'

/**
 * مبدّل اللغة في هيدر المتجر.
 *
 * ## اسم كل لغة بلغتها هي
 * «English» مكتوبة إنجليزي و«العربية» مكتوبة عربي — لا الاتنين
 * بلغة الصفحة الحالية. اللي فاتح صفحة عربي وما بيقراش عربي محتاج
 * يلاقي كلمة يعرفها عشان يخرج منها؛ لو كتبنا «الإنجليزية» بس، هو
 * أصلًا ما بيقراش الحروف دي.
 *
 * ## وبيتحفظ في كوكي على الخادم
 * الصفحة بتترسم بلغتها هناك. لو الاختيار في المتصفح، الخادم كان
 * هيبعت عربي والمتصفح يصلّحه بعدها — يعني وميض لغة غلط في كل فتحة.
 *
 * ## وما بيظهرش لو لغة واحدة
 * أغلب التجّار عربي وبس، والمبدّل بخيار واحد زحمة بلا فايدة.
 */
export function LocalePicker({ enabled, current }: { enabled: Locale[]; current: Locale }) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()
  const t = useT()

  if (enabled.length < 2) return null

  function choose(next: Locale) {
    setOpen(false)
    if (next === current) return
    start(async () => {
      await chooseLocaleAction(next)
      /*
        التحديث من الخادم لا من المتصفح.

        النصوص كلها بتترسم هناك — تحديث المتصفح وحده كان هيسيب كل
        كلمة على الصفحة زي ما هي ويغيّر المبدّل وحده.
      */
      router.refresh()
    })
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        disabled={pending}
        aria-expanded={open}
        aria-label={t('common.language')}
        className="flex h-10 items-center gap-1.5 rounded-[var(--sf-radius)] px-2 text-sm disabled:opacity-60"
      >
        <Languages className="h-4 w-4 opacity-70" aria-hidden="true" />
        <span className="font-medium uppercase">{current}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 opacity-60 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label={t('nav.close')}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute end-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 bg-[var(--sf-bg)] py-1 shadow-xl">
            {enabled.map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => choose(l)}
                dir={LOCALE_META[l].dir}
                className="flex min-h-11 w-full items-center gap-2.5 px-3 text-start text-sm transition-colors hover:bg-[var(--sf-text)]/6"
              >
                <span aria-hidden="true">{LOCALE_META[l].flag}</span>
                <span className="min-w-0 flex-1 truncate">
                  {/* اسم اللغة بلغتها — اللي بيدوّر عليها بيعرفها بشكلها */}
                  {l === 'en' ? 'English' : 'العربية'}
                </span>
                {l === current && (
                  <Check className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
