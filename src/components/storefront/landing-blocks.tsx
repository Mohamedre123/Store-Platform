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

/**
 * مقاسات النص بتتمدّد مع الشاشة.
 *
 * `clamp` بدل نقاط التوقف: العنوان اللي بيقفز من ٢٤ لـ٤٨ عند ٦٤٠
 * بكسل بيبان مكسورًا على كل مقاس بينهم — وأغلب زوّار صفحة الهبوط
 * جايين من إعلان على تليفون، يعني على المقاسات دي بالظبط.
 */
const H1 = 'clamp(1.85rem, 1.1rem + 3.4vw, 3.4rem)'
const H2 = 'clamp(1.4rem, 1.05rem + 1.6vw, 2.1rem)'

/**
 * أعمدة المعرض على الشاشة الكبيرة.
 *
 * أسماء أصناف كاملة لا مبنية بالتركيب: تيلويند بيقرا الملف نصًّا
 * وقت البناء، والاسم اللي بيتكوّن وقت التشغيل (`sm:grid-cols-${n}`)
 * ما بيوصلش للملف النهائي — فالشبكة بتفضل عمودًا واحدًا وهي مظبوطة
 * في الكود.
 */
const GALLERY_COLS: Record<number, string> = {
  1: 'sm:grid-cols-1',
  2: 'sm:grid-cols-2',
  3: 'sm:grid-cols-3',
  4: 'sm:grid-cols-4',
}

/** إيقاع الأقسام — بيتقرا من هوية الصفحة فالتاجر يتحكّم فيه */
const SECTION = { paddingBlock: 'var(--lp-gap, 3.5rem)' } as React.CSSProperties

/** بطاقة: سطح وحواف وظل، كلهم من الهوية */
const CARD = {
  background: 'var(--lp-surface)',
  borderRadius: 'var(--lp-radius)',
  boxShadow: 'var(--lp-shadow, none)',
} as React.CSSProperties

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
        <section
          className="relative mt-4 overflow-hidden"
          style={{
            borderRadius: 'var(--lp-radius)',
            /* بلا صورة: تدرّج خفيف من لون الهوية بدل مساحة بيضا ميتة */
            background: image
              ? undefined
              : 'linear-gradient(160deg, color-mix(in srgb, var(--lp-primary) 12%, var(--lp-bg)), var(--lp-bg))',
          }}
        >
          {image && (
            <>
              <Image src={image} alt="" fill sizes="100vw" className="object-cover" priority />
              {/*
                تدرّج لا طبقة سودا مصمتة: النص بيحتاج تعتيمًا تحته
                بس، والتعتيم المتساوي بيطفّي الصورة اللي التاجر
                اختارها عشان تبيع.
              */}
              <span
                className="absolute inset-0"
                style={{
                  background: `linear-gradient(to top, rgb(0 0 0 / ${Math.min(
                    (Number(s.overlay) || 0) / 100 + 0.25,
                    0.92,
                  )}), rgb(0 0 0 / ${(Number(s.overlay) || 0) / 200}))`,
                }}
                aria-hidden="true"
              />
            </>
          )}
          <div
            className={`relative flex min-h-[22rem] flex-col justify-center gap-5 px-6 py-16 sm:min-h-[28rem] sm:px-10 sm:py-24 ${alignClass}`}
            style={{ color: image ? '#fff' : 'var(--lp-text)' }}
          >
            {s.title && (
              <h1
                className="font-bold leading-[1.15] tracking-tight"
                style={{ fontSize: H1, textWrap: 'balance' }}
              >
                {s.title}
              </h1>
            )}
            {s.subtitle && (
              <p
                className="max-w-2xl text-base leading-relaxed opacity-90 sm:text-lg"
                style={{ textWrap: 'pretty' }}
              >
                {s.subtitle}
              </p>
            )}
            {s.ctaLabel && product && (
              <div className="mt-2">
                <LandingBuyButton
                  product={product}
                  storeIdentifier={storeIdentifier}
                  label={String(s.ctaLabel)}
                />
              </div>
            )}
          </div>
        </section>
      )
    }

    case 'features': {
      const items = (s.items as Array<{ icon?: string; title: string; text: string }>) ?? []
      return (
        <section style={SECTION}>
          {s.title && (
            <h2
              className="mb-10 text-center font-bold tracking-tight"
              style={{ fontSize: H2, textWrap: 'balance' }}
            >
              {s.title}
            </h2>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            {items.map((it, i) => {
              const Icon = ICONS[it.icon ?? 'check'] ?? Check
              return (
                <div
                  key={i}
                  className="flex flex-col items-center gap-3 p-6 text-center transition-transform duration-300 hover:-translate-y-1"
                  style={CARD}
                >
                  <span
                    className="flex h-14 w-14 items-center justify-center rounded-full"
                    style={{
                      background: 'color-mix(in srgb, var(--lp-primary) 14%, transparent)',
                      color: 'var(--lp-primary)',
                    }}
                  >
                    <Icon className="h-7 w-7" aria-hidden="true" />
                  </span>
                  <span className="text-lg font-bold">{it.title}</span>
                  <span className="text-sm leading-relaxed opacity-70">{it.text}</span>
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
        <section className="my-8 grid gap-8 p-5 sm:grid-cols-2 sm:p-8" style={CARD}>
          <div
            className="relative aspect-square overflow-hidden"
            style={{ borderRadius: 'var(--lp-radius)' }}
          >
            {product.images[0] && (
              <Image src={product.images[0]} alt={product.name} fill sizes="(max-width:640px) 100vw, 50vw" className="object-cover" />
            )}
          </div>

          <div className="flex flex-col justify-center gap-4">
            <h2 className="text-2xl font-bold tracking-tight" style={{ textWrap: 'balance' }}>
              {product.name}
            </h2>

            <div className="flex flex-wrap items-baseline gap-3">
              <span className="tabular text-4xl font-bold" style={{ color: 'var(--lp-primary)' }}>
                {formatMoney(product.price, currency)}
              </span>
              {s.showCompareAt !== false && product.compareAtPrice && (
                <>
                  <span className="tabular text-lg line-through opacity-45">
                    {formatMoney(product.compareAtPrice, currency)}
                  </span>
                  {/*
                    قيمة التوفير مكتوبة صراحةً.
                    السعر المشطوب لوحده بيسيب العميل يطرح بنفسه —
                    وأغلبه ما بيعملش، فالخصم بيضيع أثره.
                  */}
                  {product.compareAtPrice > product.price && (
                    <span
                      className="rounded-full px-2.5 py-1 text-xs font-bold"
                      style={{ background: 'var(--lp-primary)', color: '#fff' }}
                    >
                      وفّر {formatMoney(product.compareAtPrice - product.price, currency)}
                    </span>
                  )}
                </>
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
              <>
                <LandingBuyButton
                  product={product}
                  storeIdentifier={storeIdentifier}
                  label={String(s.ctaLabel ?? 'اطلب الآن')}
                />
                {/* سطر طمأنة تحت الزرار — المكان اللي العميل بيتردّد فيه */}
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs opacity-65">
                  <span className="flex items-center gap-1">
                    <Truck className="h-3.5 w-3.5" aria-hidden="true" /> توصيل لكل المحافظات
                  </span>
                  <span className="flex items-center gap-1">
                    <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" /> الدفع عند الاستلام
                  </span>
                </p>
              </>
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
        <section style={SECTION}>
          {s.title && (
            <h2 className="mb-6 text-center font-bold tracking-tight" style={{ fontSize: H2 }}>
              {s.title}
            </h2>
          )}
          {/*
            عمودين على الموبايل مهما كان الإعداد: تلات صور جنب بعض
            على شاشة ٣٦٠ بكسل بتبقى مربّعات صغيرة ما تتشافش، والصورة
            هي اللي بتبيع.
          */}
          <div className={`grid grid-cols-2 gap-3 ${GALLERY_COLS[Math.min(cols, 4)] ?? 'sm:grid-cols-3'}`}>
            {images.map((src, i) => (
              <span
                key={i}
                className="relative block aspect-square overflow-hidden"
                style={{ borderRadius: 'var(--lp-radius)', boxShadow: 'var(--lp-shadow, none)' }}
              >
                <Image
                  src={src}
                  alt=""
                  fill
                  sizes="(max-width:640px) 50vw, 33vw"
                  className="object-cover transition-transform duration-500 hover:scale-105"
                />
              </span>
            ))}
          </div>
        </section>
      )
    }

    case 'testimonials': {
      const items = (s.items as Array<{ name: string; text: string; rating?: number }>) ?? []
      return (
        <section style={SECTION}>
          {s.title && (
            <h2
              className="mb-10 text-center font-bold tracking-tight"
              style={{ fontSize: H2, textWrap: 'balance' }}
            >
              {s.title}
            </h2>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {items.map((t, i) => (
              <figure key={i} className="flex flex-col gap-3 p-6" style={CARD}>
                <div className="flex gap-0.5" aria-label={`${t.rating ?? 5} من ٥`}>
                  {Array.from({ length: t.rating ?? 5 }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-current text-amber-500" aria-hidden="true" />
                  ))}
                </div>
                <blockquote className="text-[0.95rem] leading-relaxed">«{t.text}»</blockquote>
                <figcaption className="mt-auto flex items-center gap-2.5 pt-1">
                  {/*
                    أول حرف من الاسم بدل صورة.
                    صور الآراء بتبقى مستوردة من الإنترنت وبتتعرف —
                    والحرف بيدّي وجهًا بشريًا بلا ادّعاء.
                  */}
                  <span
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                    style={{
                      background: 'color-mix(in srgb, var(--lp-primary) 16%, transparent)',
                      color: 'var(--lp-primary)',
                    }}
                    aria-hidden="true"
                  >
                    {t.name?.trim()?.[0] ?? '؟'}
                  </span>
                  <span className="text-sm font-semibold">{t.name}</span>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )
    }

    case 'faq': {
      const items = (s.items as Array<{ q: string; a: string }>) ?? []
      return (
        <section style={SECTION}>
          {s.title && (
            <h2
              className="mb-8 text-center font-bold tracking-tight"
              style={{ fontSize: H2, textWrap: 'balance' }}
            >
              {s.title}
            </h2>
          )}
          <div className="flex flex-col gap-2.5">
            {items.map((it, i) => (
              /* details/summary: يشتغل من غير جافاسكربت خالص */
              <details key={i} className="group px-5 py-4" style={CARD}>
                <summary className="flex cursor-pointer list-none items-center gap-3 font-semibold">
                  <span className="flex-1">{it.q}</span>
                  <span
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-lg leading-none transition-transform duration-300 group-open:rotate-45"
                    style={{
                      background: 'color-mix(in srgb, var(--lp-primary) 12%, transparent)',
                      color: 'var(--lp-primary)',
                    }}
                    aria-hidden="true"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed opacity-75">{it.a}</p>
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
          className="my-8 flex flex-col items-center gap-4 px-6 py-14 text-center sm:px-10 sm:py-20"
          style={{
            borderRadius: 'var(--lp-radius)',
            boxShadow: 'var(--lp-shadow, none)',
            /*
              الدعوة الأخيرة بلون الهوية لا بلون السطح: دي آخر نقطة
              قرار في الصفحة، ولو شكلها زي أي قسم تاني بتعدّي.
            */
            background:
              'linear-gradient(135deg, color-mix(in srgb, var(--lp-primary) 92%, black), var(--lp-primary))',
            color: '#fff',
          }}
        >
          {s.title && (
            <h2 className="font-bold tracking-tight" style={{ fontSize: H2, textWrap: 'balance' }}>
              {s.title}
            </h2>
          )}
          {s.subtitle && <p className="max-w-xl opacity-90">{s.subtitle}</p>}
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
        <section style={SECTION}>
          {s.title && (
            <h2 className="mb-4 font-bold tracking-tight" style={{ fontSize: H2 }}>
              {s.title}
            </h2>
          )}
          {s.body && (
            <div
              className="whitespace-pre-line text-[1.02rem] leading-loose opacity-85"
              /* سطر مقروء: النص اللي بيمدّ عرض الشاشة كلها بيتعب العين */
              style={{ maxWidth: '65ch', textWrap: 'pretty' }}
            >
              {s.body}
            </div>
          )}
        </section>
      )

    case 'video': {
      const url = String(s.url ?? '')
      const id = youtubeId(url)
      if (!id) return null
      return (
        <section style={SECTION}>
          {s.title && (
            <h2 className="mb-5 text-center font-bold tracking-tight" style={{ fontSize: H2 }}>
              {s.title}
            </h2>
          )}
          <div
            className="relative aspect-video overflow-hidden"
            style={{ borderRadius: 'var(--lp-radius)', boxShadow: 'var(--lp-shadow, none)' }}
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
