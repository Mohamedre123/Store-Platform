import Image from 'next/image'
import { Check, ShieldCheck, Star, Truck } from 'lucide-react'
import type { Block } from '@/lib/landing'
import { formatMoney } from '@/lib/utils'
import { LandingCountdown } from './landing-countdown'
import { LandingBuyButton } from './landing-buy-button'

export type LandingProduct = {
  id: string
  name: string
  slug: string
  price: number
  compareAtPrice: number | null
  images: string[]
  stock: number
  trackInventory: boolean
  hasVariants: boolean
} | null

const ICONS: Record<string, typeof Check> = {
  check: Check,
  truck: Truck,
  shield: ShieldCheck,
  star: Star,
}

/**
 * عرض بلوكات صفحة الهبوط.
 *
 * كل بلوك مستقل: بياخد إعداداته ويرسم نفسه. إضافة نوع جديد = فرع
 * واحد هنا وتعريف في المكتبة — من غير ما يتغيّر أي كود تاني.
 *
 * الأنماط بتستخدم متغيّرات ‎--lp-*‎ اللي بتتحقن من هوية الصفحة نفسها،
 * مش من ثيم المتجر — دي صفحة حملة ليها هويتها.
 */
export function LandingBlock({
  block,
  product,
  currency,
  storeIdentifier,
}: {
  block: Block
  product: LandingProduct
  currency: string
  storeIdentifier: string
}) {
  const s = block.settings as Record<string, never>

  switch (block.type) {
    case 'hero': {
      const image = s.image as string | null
      const align = (s.align as string) ?? 'center'
      const alignClass =
        align === 'start' ? 'items-start text-start' : align === 'end' ? 'items-end text-end' : 'items-center text-center'

      return (
        <section className="relative overflow-hidden" style={{ borderRadius: 'var(--lp-radius)' }}>
          {image && (
            <>
              <Image src={image} alt="" fill sizes="100vw" className="object-cover" priority />
              <span
                className="absolute inset-0 bg-black"
                style={{ opacity: (Number(s.overlay) || 0) / 100 }}
                aria-hidden="true"
              />
            </>
          )}
          <div
            className={`relative flex flex-col gap-4 px-6 py-16 sm:py-24 ${alignClass}`}
            style={{ color: image ? '#fff' : 'var(--lp-text)' }}
          >
            {s.title && <h1 className="text-3xl font-bold leading-tight sm:text-5xl">{s.title}</h1>}
            {s.subtitle && <p className="max-w-xl text-lg opacity-90">{s.subtitle}</p>}
            {s.ctaLabel && product && (
              <LandingBuyButton
                product={product}
                storeIdentifier={storeIdentifier}
                label={String(s.ctaLabel)}
              />
            )}
          </div>
        </section>
      )
    }

    case 'features': {
      const items = (s.items as Array<{ icon?: string; title: string; text: string }>) ?? []
      return (
        <section className="py-12">
          {s.title && <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">{s.title}</h2>}
          <div className="grid gap-6 sm:grid-cols-3">
            {items.map((it, i) => {
              const Icon = ICONS[it.icon ?? 'check'] ?? Check
              return (
                <div key={i} className="flex flex-col items-center gap-2 text-center">
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: 'var(--lp-primary)', color: '#fff' }}
                  >
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="font-bold">{it.title}</span>
                  <span className="text-sm opacity-70">{it.text}</span>
                </div>
              )
            })}
          </div>
        </section>
      )
    }

    case 'product': {
      if (!product) return null
      const soldOut = product.trackInventory && product.stock <= 0
      return (
        <section
          className="my-8 grid gap-8 p-6 sm:grid-cols-2 sm:p-8"
          style={{ background: 'var(--lp-surface)', borderRadius: 'var(--lp-radius)' }}
        >
          <div
            className="relative aspect-square overflow-hidden"
            style={{ borderRadius: 'var(--lp-radius)' }}
          >
            {product.images[0] && (
              <Image src={product.images[0]} alt={product.name} fill sizes="(max-width:640px) 100vw, 50vw" className="object-cover" />
            )}
          </div>

          <div className="flex flex-col justify-center gap-4">
            <h2 className="text-2xl font-bold">{product.name}</h2>

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="tabular text-3xl font-bold" style={{ color: 'var(--lp-primary)' }}>
                {formatMoney(product.price, currency)}
              </span>
              {s.showCompareAt !== false && product.compareAtPrice && (
                <span className="tabular text-lg line-through opacity-45">
                  {formatMoney(product.compareAtPrice, currency)}
                </span>
              )}
            </div>

            {s.showStock !== false && product.trackInventory && product.stock > 0 && product.stock <= 10 && (
              <p className="text-sm font-medium text-amber-600">
                باقي {product.stock} بس في المخزن
              </p>
            )}

            {soldOut ? (
              <p className="font-medium opacity-60">نفدت الكمية</p>
            ) : (
              <LandingBuyButton
                product={product}
                storeIdentifier={storeIdentifier}
                label={String(s.ctaLabel ?? 'اطلب الآن')}
              />
            )}
          </div>
        </section>
      )
    }

    case 'gallery': {
      const images = (s.images as string[]) ?? []
      if (images.length === 0) return null
      const cols = Number(s.columns) || 3
      return (
        <section className="py-10">
          {s.title && <h2 className="mb-6 text-center text-2xl font-bold">{s.title}</h2>}
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: `repeat(${Math.min(cols, 4)}, minmax(0,1fr))` }}
          >
            {images.map((src, i) => (
              <span
                key={i}
                className="relative block aspect-square overflow-hidden"
                style={{ borderRadius: 'var(--lp-radius)' }}
              >
                <Image src={src} alt="" fill sizes="33vw" className="object-cover" />
              </span>
            ))}
          </div>
        </section>
      )
    }

    case 'testimonials': {
      const items = (s.items as Array<{ name: string; text: string; rating?: number }>) ?? []
      return (
        <section className="py-12">
          {s.title && <h2 className="mb-8 text-center text-2xl font-bold sm:text-3xl">{s.title}</h2>}
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((t, i) => (
              <div
                key={i}
                className="flex flex-col gap-2 p-5"
                style={{ background: 'var(--lp-surface)', borderRadius: 'var(--lp-radius)' }}
              >
                <div className="flex gap-0.5">
                  {Array.from({ length: t.rating ?? 5 }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-current text-amber-500" aria-hidden="true" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed">«{t.text}»</p>
                <span className="text-sm font-medium opacity-70">— {t.name}</span>
              </div>
            ))}
          </div>
        </section>
      )
    }

    case 'faq': {
      const items = (s.items as Array<{ q: string; a: string }>) ?? []
      return (
        <section className="py-12">
          {s.title && <h2 className="mb-6 text-center text-2xl font-bold sm:text-3xl">{s.title}</h2>}
          <div className="flex flex-col gap-3">
            {items.map((it, i) => (
              /* details/summary: يشتغل من غير جافاسكربت خالص */
              <details
                key={i}
                className="group p-4"
                style={{ background: 'var(--lp-surface)', borderRadius: 'var(--lp-radius)' }}
              >
                <summary className="cursor-pointer list-none font-medium">
                  {it.q}
                  <span className="float-start opacity-40 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-2 text-sm leading-relaxed opacity-75">{it.a}</p>
              </details>
            ))}
          </div>
        </section>
      )
    }

    case 'countdown':
      return <LandingCountdown title={String(s.title ?? '')} minutes={Number(s.minutes) || 30} />

    case 'cta':
      return (
        <section
          className="my-8 flex flex-col items-center gap-4 px-6 py-12 text-center"
          style={{ background: 'var(--lp-surface)', borderRadius: 'var(--lp-radius)' }}
        >
          {s.title && <h2 className="text-2xl font-bold sm:text-3xl">{s.title}</h2>}
          {s.subtitle && <p className="opacity-70">{s.subtitle}</p>}
          {product && (
            <LandingBuyButton
              product={product}
              storeIdentifier={storeIdentifier}
              label={String(s.ctaLabel ?? 'اطلب الآن')}
            />
          )}
        </section>
      )

    case 'text':
      return (
        <section className="py-10">
          {s.title && <h2 className="mb-4 text-2xl font-bold">{s.title}</h2>}
          {s.body && <div className="whitespace-pre-line leading-loose opacity-85">{s.body}</div>}
        </section>
      )

    case 'video': {
      const url = String(s.url ?? '')
      const id = youtubeId(url)
      if (!id) return null
      return (
        <section className="py-10">
          {s.title && <h2 className="mb-4 text-center text-2xl font-bold">{s.title}</h2>}
          <div
            className="relative aspect-video overflow-hidden"
            style={{ borderRadius: 'var(--lp-radius)' }}
          >
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${id}`}
              title="فيديو"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          </div>
        </section>
      )
    }

    default:
      return null
  }
}

/**
 * معرّف فيديو يوتيوب من أي شكل رابط.
 * بنستخدم youtube-nocookie عشان ما نحطّش كوكيز تتبّع على زوّار التاجر.
 */
function youtubeId(url: string): string | null {
  const m = url.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([A-Za-z0-9_-]{11})/)
  return m?.[1] ?? null
}
