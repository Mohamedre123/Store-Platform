'use client'

import { Printer } from 'lucide-react'

/**
 * طباعة الفاتورة (أو حفظها PDF من نافذة الطباعة).
 *
 * `window.print` لا توليد PDF على الخادم: المتصفح بيعمل الاتنين —
 * طباعة وحفظ — وشغّال على الفون زي الكمبيوتر. مكتبة PDF كانت هتزوّد
 * الحزمة ميجات عشان زرار واحد.
 */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="flex min-h-11 items-center justify-center gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/20 px-4 text-sm font-medium transition-colors hover:bg-[var(--sf-text)]/5"
    >
      <Printer className="h-4 w-4" aria-hidden="true" />
      اطبع أو احفظ PDF
    </button>
  )
}
