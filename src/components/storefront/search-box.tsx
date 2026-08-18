'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { useStoreHref } from './store-link'

/** خانة البحث — بتوجّه لصفحة النتايج بالاستعلام في الرابط */
export function SearchBox({
  initialQuery = '',
  autoFocus = false,
  compact = false,
}: {
  initialQuery?: string
  autoFocus?: boolean
  compact?: boolean
}) {
  const [q, setQ] = useState(initialQuery)
  const router = useRouter()
  const href = useStoreHref()

  function go() {
    const query = q.trim()
    if (query.length < 2) return
    router.push(href(`/search?q=${encodeURIComponent(query)}`))
  }

  return (
    <div className="flex gap-2">
      <div className="relative flex-1">
        <Search
          className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 opacity-45 end-3"
          aria-hidden="true"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && go()}
          autoFocus={autoFocus}
          type="search"
          aria-label="ابحث في المنتجات"
          placeholder="ابحث في المنتجات…"
          className={`w-full rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] pe-10 ps-3 outline-none focus:border-[var(--sf-primary)] ${
            compact ? 'h-10 text-sm' : 'h-12 text-base'
          }`}
        />
      </div>
      <button
        type="button"
        onClick={go}
        disabled={q.trim().length < 2}
        className={`shrink-0 rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-5 font-semibold text-white disabled:opacity-50 ${
          compact ? 'h-10 text-sm' : 'h-12'
        }`}
      >
        بحث
      </button>
    </div>
  )
}
