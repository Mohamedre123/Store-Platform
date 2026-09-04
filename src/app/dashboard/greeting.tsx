'use client'

import { useEffect, useState } from 'react'
import { ExternalLink } from 'lucide-react'

/**
 * تحية بتوقيت المتجر.
 *
 * ## ليه في المتصفح مش على الخادم
 * الخادم على UTC. «صباح الخير» محسوبة هناك بتوصل تاجر في القاهرة
 * الساعة تلاتة بعد الضهر — وده بيخلّي اللوحة تبان كأنها مش عارفة
 * هو فين.
 *
 * والتصيير الأول بيطلع بلا تحية (`suppressHydrationWarning` مش
 * محتاجينها): النص بيتحط بعد أول رسمة، فمفيش فرق بين الخادم
 * والمتصفح يتكسر عنده.
 */
export function Greeting({
  storeName,
  storeUrl,
}: {
  storeName: string
  storeUrl: string
}) {
  const [hour, setHour] = useState<number | null>(null)

  useEffect(() => {
    setHour(new Date().getHours())
  }, [])

  const salutation =
    hour === null
      ? 'أهلًا'
      : hour < 5
        ? 'مساء الخير'
        : hour < 12
          ? 'صباح الخير'
          : hour < 17
            ? 'نهارك سعيد'
            : 'مساء الخير'

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight">
          {salutation}، {storeName}
        </h1>
        <p className="text-sm text-[var(--fg-muted)]">إليك اللي بيحصل في متجرك النهارده.</p>
      </div>

      <a
        href={storeUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg border border-[var(--border-strong)] px-4 text-sm font-medium text-[var(--fg-muted)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--fg)]"
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        زيارة المتجر
      </a>
    </div>
  )
}
