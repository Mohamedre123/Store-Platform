import Image from 'next/image'
import { SLink as Link } from './store-link'
import { ArrowLeft } from 'lucide-react'

export type PromoBannerData = {
  id: string
  title: string | null
  subtitle: string | null
  imageDesktop: string | null
  imageMobile: string | null
  ctaLabel: string | null
  ctaUrl: string | null
}

/**
 * بانر ترويجي.
 *
 * لو فيه صورة بتبقى هي الخلفية والنص فوقها بطبقة تعتيم؛ لو مفيش، بنرسم
 * بطاقة بلون المتجر. الشكلين يشتغلوا — عشان التاجر اللي مالوش مصمّم
 * يقدر يعلن عن عرضه بعنوان مكتوب بس.
 */
export function PromoBanner({ banner: b }: { banner: PromoBannerData }) {
  const hasImage = Boolean(b.imageDesktop)
  const hasText = Boolean(b.title || b.subtitle)

  const inner = (
    <>
      {hasImage && (
        <>
          {/* صورة الموبايل لو موجودة، وإلا صورة الكمبيوتر على الاتنين */}
          <Image
            src={b.imageMobile || b.imageDesktop!}
            alt={b.title ?? ''}
            fill
            sizes="100vw"
            className="object-cover sm:hidden"
          />
          <Image
            src={b.imageDesktop!}
            alt={b.title ?? ''}
            fill
            sizes="(max-width: 1152px) 100vw, 1152px"
            className="hidden object-cover sm:block"
          />
          {hasText && <span className="absolute inset-0 bg-black/35" aria-hidden="true" />}
        </>
      )}

      {hasText && (
        <span
          className={`relative flex flex-col items-start gap-2 p-6 sm:p-8 ${
            hasImage ? 'text-white' : ''
          }`}
        >
          {b.title && <span className="text-xl font-bold sm:text-2xl">{b.title}</span>}
          {b.subtitle && <span className="text-sm opacity-90 sm:text-base">{b.subtitle}</span>}
          {b.ctaLabel && (
            <span
              className={`mt-2 inline-flex items-center gap-1.5 rounded-[var(--sf-radius)] px-4 py-2 text-sm font-semibold ${
                hasImage ? 'bg-white text-black' : 'bg-[var(--sf-primary)] text-white'
              }`}
            >
              {b.ctaLabel}
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            </span>
          )}
        </span>
      )}
    </>
  )

  const className = `relative block overflow-hidden rounded-[var(--sf-radius)] ${
    hasImage ? 'min-h-40 sm:min-h-56' : 'bg-[var(--sf-primary)]/8'
  }`

  if (b.ctaUrl) {
    return (
      <Link href={b.ctaUrl} className={`${className} transition-opacity hover:opacity-95`}>
        {inner}
      </Link>
    )
  }

  return <div className={className}>{inner}</div>
}
