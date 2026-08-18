'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { SLink as Link } from './store-link'
import { ArrowUpDown } from 'lucide-react'
import { SORT_OPTIONS, type SortKey } from '@/lib/sort-options'

/**
 * أدوات صفحة المنتجات: الترتيب وفلتر الأقسام.
 *
 * الترتيب بيتحط في الرابط (‎?sort=‎) مش في حالة المتصفح — كده العميل
 * يقدر يشارك الرابط أو يرجع لورا والاختيار يفضل، والخادم هو اللي بيرتّب.
 */
export function ListingControls({
  showSort,
  showCategoryFilter,
  categories,
  activeCategory,
}: {
  showSort: boolean
  showCategoryFilter: boolean
  categories: Array<{ name: string; slug: string }>
  activeCategory?: string
}) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const sort = (params.get('sort') as SortKey) || 'newest'

  if (!showSort && !(showCategoryFilter && categories.length > 0)) return null

  function changeSort(next: string) {
    const q = new URLSearchParams(params.toString())
    if (next === 'newest') q.delete('sort')
    else q.set('sort', next)
    router.push(`${pathname}${q.toString() ? `?${q}` : ''}`, { scroll: false })
  }

  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      {showCategoryFilter && categories.length > 0 ? (
        <div className="scroll-x flex items-center gap-1.5">
          <Link
            href="/products"
            className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm transition-colors ${
              !activeCategory
                ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/10 text-[var(--sf-primary)]'
                : 'border-[var(--sf-text)]/15 opacity-70 hover:opacity-100'
            }`}
          >
            الكل
          </Link>
          {categories.map((c) => (
            <Link
              key={c.slug}
              href={`/category/${c.slug}`}
              className={`shrink-0 whitespace-nowrap rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                activeCategory === c.slug
                  ? 'border-[var(--sf-primary)] bg-[var(--sf-primary)]/10 text-[var(--sf-primary)]'
                  : 'border-[var(--sf-text)]/15 opacity-70 hover:opacity-100'
              }`}
            >
              {c.name}
            </Link>
          ))}
        </div>
      ) : (
        <span />
      )}

      {showSort && (
        <label className="flex shrink-0 items-center gap-2 text-sm">
          <ArrowUpDown className="h-4 w-4 opacity-60" aria-hidden="true" />
          <span className="sr-only">ترتيب المنتجات</span>
          <select
            value={sort}
            onChange={(e) => changeSort(e.target.value)}
            className="h-10 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/18 bg-[var(--sf-surface)] px-3 text-sm outline-none focus:border-[var(--sf-primary)]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}
