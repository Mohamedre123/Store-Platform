'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { ImagePlus, Loader2, Monitor, Smartphone, Star, X } from 'lucide-react'
import { IMAGE_SPECS } from '@/lib/themes'
import { cn } from '@/lib/utils'

/**
 * رفع الصور.
 *
 * المقاس المطلوب مكتوب جنب الخانة قبل الرفع لا بعده — ده أهم تفصيلة
 * هنا. التاجر بيرفع صورة بمقاس عشوائي فتطلع مقصوصة وميعرفش ليه،
 * فبنقوله المقاس والنسبة والغرض من الأول.
 */

function SpecLine({ specKey }: { specKey: keyof typeof IMAGE_SPECS }) {
  const spec = IMAGE_SPECS[specKey]
  const Icon = spec.height > spec.width ? Smartphone : Monitor

  return (
    <div className="flex items-start gap-2 text-xs">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--primary)]" aria-hidden="true" />
      <p className="leading-relaxed text-[var(--fg-muted)]">
        <bdi dir="ltr" className="num font-semibold text-[var(--primary)]">
          {spec.width} × {spec.height}
        </bdi>{' '}
        — {spec.note}
      </p>
    </div>
  )
}

export function ImageUpload({
  value,
  onChange,
  folder = 'products',
  specKey,
  label,
  multiple = false,
  max = 8,
}: {
  value: string[]
  onChange: (urls: string[]) => void
  folder?: 'products' | 'categories' | 'banners' | 'logos' | 'misc'
  specKey?: keyof typeof IMAGE_SPECS
  label?: string
  multiple?: boolean
  max?: number
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  async function upload(files: FileList | File[]) {
    setError(null)
    const list = Array.from(files).slice(0, multiple ? max - value.length : 1)
    if (!list.length) return

    setBusy(true)
    const uploaded: string[] = []

    for (const file of list) {
      const body = new FormData()
      body.append('file', file)
      body.append('folder', folder)
      try {
        const res = await fetch('/api/upload', { method: 'POST', body })
        const data = (await res.json()) as { url?: string; error?: string }
        if (data.url) uploaded.push(data.url)
        else setError(data.error ?? 'فشل الرفع')
      } catch {
        setError('مشكلة في الاتصال. جرّب تاني.')
      }
    }

    setBusy(false)
    if (uploaded.length) onChange(multiple ? [...value, ...uploaded] : uploaded)
  }

  const canAdd = multiple ? value.length < max : value.length === 0

  return (
    <div className="flex flex-col gap-2.5">
      {label && <span className="text-sm font-medium">{label}</span>}
      {specKey && <SpecLine specKey={specKey} />}

      <div className={cn('grid gap-2.5', multiple ? 'grid-cols-3 sm:grid-cols-4' : 'grid-cols-1')}>
        {value.map((url, i) => (
          <div
            key={url}
            className="group relative aspect-square overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface-2)]"
          >
            <Image src={url} alt="" fill sizes="200px" className="object-cover" />

            {multiple && i === 0 && (
              <span className="absolute start-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-[var(--color-ink-950)]/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                <Star className="h-2.5 w-2.5 fill-current" aria-hidden="true" />
                الرئيسية
              </span>
            )}

            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== url))}
              aria-label="حذف الصورة"
              className="absolute end-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-md bg-[var(--color-ink-950)]/70 text-white transition-opacity hover:bg-[var(--color-danger)]"
            >
              <X className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        ))}

        {canAdd && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setDragging(true)
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDragging(false)
              if (e.dataTransfer.files.length) upload(e.dataTransfer.files)
            }}
            disabled={busy}
            className={cn(
              'flex aspect-square flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors',
              dragging
                ? 'border-[var(--primary)] bg-[var(--primary-soft)]'
                : 'border-[var(--border-strong)] hover:border-[var(--primary)] hover:bg-[var(--surface-2)]',
              busy && 'opacity-60',
            )}
          >
            {busy ? (
              <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" aria-hidden="true" />
            ) : (
              <ImagePlus className="h-6 w-6 text-[var(--fg-subtle)]" aria-hidden="true" />
            )}
            <span className="px-2 text-center text-xs text-[var(--fg-muted)]">
              {busy ? 'جاري الرفع…' : 'اضغط أو اسحب الصورة'}
            </span>
          </button>
        )}
      </div>

      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple={multiple}
        hidden
        onChange={(e) => {
          if (e.target.files?.length) upload(e.target.files)
          e.target.value = ''
        }}
      />

      {error && <p className="text-xs text-[var(--color-danger)]">{error}</p>}
      {multiple && value.length > 1 && (
        <p className="text-xs text-[var(--fg-subtle)]">
          أول صورة هي اللي بتظهر في قائمة المنتجات. امسح وارفع لو عايز تغيّرها.
        </p>
      )}
    </div>
  )
}
