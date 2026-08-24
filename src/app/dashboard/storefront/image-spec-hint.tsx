import { Monitor, Smartphone } from 'lucide-react'
import { IMAGE_SPECS } from '@/lib/themes'

/**
 * بطاقة تشرح مقاس صورة مطلوب.
 *
 * التاجر بيرفع صورة بمقاس عشوائي فتطلع مقصوصة، وميعرفش السبب.
 * فبنقوله المقاس بالبكسل والنسبة والغرض — قبل ما يرفع لا بعد ما يشتكي.
 */
export function ImageSpecHint({ specKey }: { specKey: keyof typeof IMAGE_SPECS }) {
  const spec = IMAGE_SPECS[specKey]
  const isPortrait = spec.height > spec.width
  const Icon = isPortrait ? Smartphone : Monitor

  const ratio = (() => {
    const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a)
    const g = gcd(spec.width, spec.height)
    return `${spec.width / g}:${spec.height / g}`
  })()

  return (
    <div className="flex items-start gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--surface)] text-[var(--primary)]">
        <Icon className="h-4 w-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="text-sm font-semibold">{spec.label}</span>
          <span dir="ltr" className="num text-xs font-medium text-[var(--primary)]">
            {spec.width} × {spec.height} px
          </span>
          <span dir="ltr" className="num text-xs text-[var(--fg-subtle)]">
            ({ratio})
          </span>
        </div>
        <p className="mt-1 text-xs leading-relaxed text-[var(--fg-muted)]">{spec.note}</p>
      </div>
    </div>
  )
}
