'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronDown } from 'lucide-react'
import { chooseMarketAction } from '@/app/s/[store]/market-actions'
import { countryFlag, type MarketRow } from '@/lib/markets-meta'
import { cn } from '@/lib/utils'

/**
 * مبدّل السوق في هيدر المتجر.
 *
 * ## ليه اختيار الزائر بيغلب على بلده
 * العميل المصري المسافر ممكن يبقى عايز يشتري بالجنيه وهو في
 * السعودية، والعكس. لو تجاهلنا اختياره وفرضنا بلده، المبدّل بيبان
 * مكسورًا — بيدوس ومحصلش حاجة.
 *
 * ## وبيتحفظ في كوكي على الخادم لا في المتصفح
 * السعر بيتحسب على الخادم، فلو الاختيار في `localStorage` كان
 * الخادم هيرسم بعملة والمتصفح يصلّحها بعدها — يعني وميض السعر
 * القديم في كل فتحة صفحة.
 *
 * ## وما بيظهرش لو سوق واحد
 * مبدّل بخيار واحد زحمة بلا فايدة.
 */
export function MarketPicker({
  markets,
  current,
}: {
  markets: MarketRow[]
  current: MarketRow
}) {
  const [open, setOpen] = useState(false)
  const [pending, start] = useTransition()
  const router = useRouter()

  const active = markets.filter((m) => m.isActive)
  if (active.length < 2) return null

  function choose(id: string) {
    setOpen(false)
    if (id === current.id) return
    start(async () => {
      await chooseMarketAction(id)
      /*
        التحديث لازم يكون من الخادم.

        الأسعار كلها بتتحسب هناك، فتحديث المتصفح وحده كان هيسيب
        كل رقم على الصفحة زي ما هو.
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
        aria-label="غيّر البلد والعملة"
        className="flex h-10 items-center gap-1.5 rounded-[var(--sf-radius)] px-2 text-sm disabled:opacity-60"
      >
        <span aria-hidden="true">{countryFlag(current.country)}</span>
        <span className="font-medium">{current.currency}</span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 opacity-60 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="إغلاق"
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 cursor-default"
          />
          <div className="absolute end-0 top-full z-50 mt-1 w-48 overflow-hidden rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 bg-[var(--sf-bg)] py-1 shadow-xl">
            {active.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => choose(m.id)}
                className="flex min-h-11 w-full items-center gap-2.5 px-3 text-start text-sm transition-colors hover:bg-[var(--sf-text)]/6"
              >
                <span aria-hidden="true">{countryFlag(m.country)}</span>
                <span className="min-w-0 flex-1 truncate">{m.name}</span>
                <span className="shrink-0 text-xs opacity-60">{m.currency}</span>
                {m.id === current.id && (
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
