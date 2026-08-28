'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { Loader2, Search, X } from 'lucide-react'

/**
 * البحث عن حساب.
 *
 * بيمشي في الرابط (`?q=`) لا في حالة داخلية: النتيجة بتبقى قابلة
 * للمشاركة والرجوع بزرار المتصفح — والتحديث بعد التفعيل بيرجّع نفس
 * البحث بدل ما يفضّي الشاشة وأنا لسه شغّال على نفس التاجر.
 */
export function AdminSearch({ initial }: { initial: string }) {
  const router = useRouter()
  const params = useSearchParams()
  const [value, setValue] = useState(initial)
  const [pending, start] = useTransition()

  function submit(next: string) {
    const q = new URLSearchParams(params.toString())
    if (next.trim()) q.set('q', next.trim())
    else q.delete('q')
    start(() => router.push('/dashboard/admin' + (q.toString() ? '?' + q : '')))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        submit(value)
      }}
      className="flex items-stretch gap-2"
      role="search"
    >
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)] start-3"
          aria-hidden="true"
        />
        <input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="معرّف الحساب أو اسم المتجر أو البريد…"
          aria-label="ابحث عن حساب"
          className="min-h-11 w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 text-sm outline-none transition-colors ps-9 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary)]/20"
        />
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              submit('')
            }}
            aria-label="امسح البحث"
            className="absolute top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-[var(--fg-subtle)] transition-colors end-2 hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg bg-[var(--primary)] px-5 text-sm font-semibold text-[var(--primary-fg)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Search className="h-4 w-4" aria-hidden="true" />
        )}
        دوّر
      </button>
    </form>
  )
}
