'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Loader2, Package, Search, ShoppingBag, User, X } from 'lucide-react'
import { quickSearchAction } from './search-actions'
import type { SearchHit } from '@/lib/quick-search'
import { cn } from '@/lib/utils'

const ICONS = { order: ShoppingBag, product: Package, customer: User } as const
const KIND_LABELS = { order: 'الطلبات', product: 'المنتجات', customer: 'العملاء' } as const

/**
 * البحث السريع — من أي شاشة.
 *
 * ## المشكلة اللي بيحلّها
 * العميل بيكلّم التاجر: «طلبي رقم ٤٢٠ فين؟». التاجر كان لازم يفتح
 * قايمة الطلبات، يستنّاها تحمّل، يكتب في فلترها. تلات خطوات لسؤال
 * بيتسأل عشرات المرات في اليوم، وهو واقف ماسك التليفون بإيد.
 *
 * ## التأخير ٢٥٠ مللي لا صفر
 * البحث مع كل حرف معناه ثمن استعلامات لكلمة من تمن حروف — سبعة
 * منهم نتايجهم بتترمي قبل ما تتعرض أصلًا. الربع ثانية هي الفرق
 * بين «بيكتب» و«خلّص».
 *
 * ## والرد القديم بيترمي
 * لو «طل» رجعت بعد «طلب»، النتايج بتاعت «طل» كانت هتغلب. العدّاد
 * بيخلّي آخر طلب هو اللي بيكتب — من غيره التاجر بيشوف نتايج
 * ما تخصّش اللي كتبه.
 */
export function QuickSearch({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [hits, setHits] = useState<SearchHit[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const seq = useRef(0)
  const pathname = usePathname()

  /* التركيز على الخانة أول ما تفتح — التاجر فتحها عشان يكتب */
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  /**
   * التنقّل بيقفلها — من غير كده بتفضل فوق الصفحة الجديدة.
   *
   * **والمسار الأول بيتخطّى.** `useEffect` بتشتغل عند التركيب زي ما
   * بتشتغل عند التغيير، فمن غير المرساة دي الشاشة كانت بتقفل نفسها
   * في نفس اللحظة اللي بتفتح فيها — التاجر يدوس على البحث وما
   * يحصلش حاجة خالص.
   */
  const openedAt = useRef(pathname)
  useEffect(() => {
    if (pathname === openedAt.current) return
    onClose()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setHits([])
      setLoading(false)
      return
    }

    setLoading(true)
    const mine = ++seq.current
    const timer = setTimeout(async () => {
      const res = await quickSearchAction(q)
      if (seq.current !== mine) return
      setHits(res.hits)
      setLoading(false)
    }, 250)

    return () => clearTimeout(timer)
  }, [query])

  /* Esc بيقفل — أسرع من التصويب على زرار على الديسكتوب */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const grouped = (['order', 'product', 'customer'] as const)
    .map((kind) => ({ kind, items: hits.filter((h) => h.kind === kind) }))
    .filter((g) => g.items.length > 0)

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-[var(--bg)] sm:bg-[var(--color-ink-950)]/60 sm:p-6">
      {/* الخلفية على الشاشة الواسعة بتقفل بالدوس */}
      <button
        type="button"
        aria-label="إغلاق البحث"
        onClick={onClose}
        className="absolute inset-0 hidden sm:block"
      />

      <div className="zw-sheet relative mx-auto flex min-h-0 w-full flex-1 flex-col sm:max-w-xl sm:flex-none sm:rounded-2xl sm:border sm:border-[var(--border)] sm:bg-[var(--surface)] sm:shadow-2xl">
        {/* الخانة */}
        <div className="safe-top flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-3 py-2.5 sm:py-3">
          <Search className="h-5 w-5 shrink-0 text-[var(--fg-subtle)]" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="رقم طلب، اسم عميل، منتج…"
            aria-label="ابحث في متجرك"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-[var(--fg-subtle)]"
          />
          {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[var(--fg-subtle)]" aria-hidden="true" />}
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--surface-2)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* النتايج */}
        <div className="min-h-0 flex-1 overflow-y-auto p-2 sm:max-h-[60vh]">
          {query.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm leading-relaxed text-[var(--fg-muted)]">
              اكتب حرفين على الأقل. بندوّر في الطلبات بالرقم وبالاسم وبالتليفون، وفي المنتجات
              بالاسم وبالكود، وفي العملاء.
            </p>
          ) : grouped.length === 0 && !loading ? (
            <p className="px-3 py-8 text-center text-sm text-[var(--fg-muted)]">
              مفيش نتايج لـ«{query.trim()}»
            </p>
          ) : (
            grouped.map((group) => {
              const Icon = ICONS[group.kind]
              return (
                <div key={group.kind} className="mb-2">
                  <p className="px-3 py-1.5 text-xs font-medium text-[var(--fg-subtle)]">
                    {KIND_LABELS[group.kind]}
                  </p>
                  {group.items.map((hit) => (
                    <Link
                      key={`${hit.kind}-${hit.id}`}
                      href={hit.href}
                      onClick={onClose}
                      className={cn(
                        'flex min-h-14 items-center gap-3 rounded-xl px-3 transition-colors',
                        'hover:bg-[var(--surface-2)]',
                      )}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-[var(--fg-muted)]">
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{hit.title}</span>
                        {hit.subtitle && (
                          <span className="block truncate text-xs text-[var(--fg-subtle)]">
                            {hit.subtitle}
                          </span>
                        )}
                      </span>
                    </Link>
                  ))}
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
