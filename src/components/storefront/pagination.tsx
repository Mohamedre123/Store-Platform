import { SLink as Link } from './store-link'
import { ChevronLeft, ChevronRight } from 'lucide-react'

/**
 * ترقيم صفحات المنتجات.
 *
 * ## ليه روابط حقيقية مش زرار جافاسكريبت
 * `?page=2` بيتشارك وبيترجع له وبيتفهرس. زرار «شوف المزيد» بيخلّي
 * الصفحة التانية غير موجودة عند جوجل — فمتجر بمية منتج بيتفهرس منه
 * أربعة وعشرين.
 *
 * ## والأرقام محدودة بخمسة
 * متجر بخمسين صفحة بيرسم خمسين زرار على موبايل. الشكل هنا: الأولى،
 * وشوية حوالين الحالية، والأخيرة — والباقي «…».
 */
export function Pagination({
  page,
  totalPages,
  /** المسار الأساسي بلا استعلام — «/products» أو «/category/x» */
  basePath,
  /** باقي الاستعلام اللي لازم يفضل (الفرز مثلًا) */
  params,
}: {
  page: number
  totalPages: number
  basePath: string
  params?: Record<string, string | undefined>
}) {
  if (totalPages <= 1) return null

  const href = (p: number) => {
    const qs = new URLSearchParams()
    for (const [k, v] of Object.entries(params ?? {})) if (v) qs.set(k, v)
    if (p > 1) qs.set('page', String(p))
    const q = qs.toString()
    return q ? `${basePath}?${q}` : basePath
  }

  /* الأولى، والحالية وجيرانها، والأخيرة — بلا تكرار */
  const numbers = [
    ...new Set(
      [1, page - 1, page, page + 1, totalPages].filter((p) => p >= 1 && p <= totalPages),
    ),
  ].sort((a, b) => a - b)

  return (
    <nav aria-label="صفحات المنتجات" className="mt-10 flex items-center justify-center gap-1.5">
      {page > 1 && (
        <Link
          href={href(page - 1)}
          aria-label="الصفحة السابقة"
          className="flex h-10 w-10 items-center justify-center rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 transition-colors hover:bg-[var(--sf-text)]/5"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}

      {numbers.map((p, i) => {
        const gap = i > 0 && p - numbers[i - 1] > 1
        return (
          <span key={p} className="flex items-center gap-1.5">
            {gap && (
              <span className="px-1 text-sm opacity-40" aria-hidden="true">
                …
              </span>
            )}
            <Link
              href={href(p)}
              aria-current={p === page ? 'page' : undefined}
              className={`tabular flex h-10 min-w-10 items-center justify-center rounded-[var(--sf-radius)] px-3 text-sm font-medium transition-colors ${
                p === page
                  ? 'bg-[var(--sf-primary)] text-white'
                  : 'border border-[var(--sf-text)]/15 hover:bg-[var(--sf-text)]/5'
              }`}
            >
              {p}
            </Link>
          </span>
        )
      })}

      {page < totalPages && (
        <Link
          href={href(page + 1)}
          aria-label="الصفحة التالية"
          className="flex h-10 w-10 items-center justify-center rounded-[var(--sf-radius)] border border-[var(--sf-text)]/15 transition-colors hover:bg-[var(--sf-text)]/5"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </nav>
  )
}
