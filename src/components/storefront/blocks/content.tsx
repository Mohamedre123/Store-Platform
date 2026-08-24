import Image from 'next/image'
import {
  BadgeCheck,
  ChevronDown,
  CreditCard,
  Gift,
  Headphones,
  Heart,
  Leaf,
  Lock,
  Package,
  Percent,
  Quote,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Timer,
  Truck,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import { SLink as Link } from '../store-link'
import { BlockHead, BlockItem, BlockShell, hoverClass, type BlockChrome } from './shell'
import type {
  FaqBlock,
  FeaturesBlock,
  GalleryBlock,
  LogosBlock,
  RichTextBlock,
  TestimonialsBlock,
  VideoBlock,
} from '@/lib/blocks'

/* ────────────────────────── نص وزر ────────────────────────── */

export function RichTextBlockView({ block, chrome }: { block: RichTextBlock; chrome: BlockChrome }) {
  if (!block.heading && !block.body && !block.ctaLabel) return null

  return (
    <BlockShell background={block.background} chrome={chrome}>
      <div
        className={`flex flex-col gap-4 ${block.width === 'narrow' ? 'mx-auto max-w-2xl' : ''} ${
          block.align === 'center' ? 'items-center text-center' : 'items-start text-start'
        }`}
      >
        {block.heading && (
          <h2
            className="text-2xl font-bold tracking-tight sm:text-3xl"
            style={{ fontFamily: 'var(--sf-font-heading)' }}
          >
            {block.heading}
          </h2>
        )}

        {/*
          سطور التاجر بتتحوّل لفقرات.
          الكلام اللي بيتلزق من ملف نصّي بيوصل بأسطر جديدة، والHTML
          بيبلعها كلها فيطلع حيطة كلام محدّش بيقراها.
        */}
        {block.body && (
          <div className="flex flex-col gap-3 text-base leading-relaxed opacity-80">
            {block.body.split(/\n{1,}/).map((line, i) =>
              line.trim() ? <p key={i}>{line}</p> : null,
            )}
          </div>
        )}

        {block.ctaLabel && block.ctaUrl && (
          <Link
            href={block.ctaUrl}
            className="mt-1 inline-flex min-h-11 items-center rounded-[var(--sf-radius)] bg-[var(--sf-primary)] px-7 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
          >
            {block.ctaLabel}
          </Link>
        )}
      </div>
    </BlockShell>
  )
}

/* ────────────────────────── المميّزات ────────────────────────── */

/**
 * الأيقونات المتاحة للتاجر.
 *
 * قايمة مقفولة لا أي اسم من المكتبة: الاسم الغلط بيرسم فراغ، والتاجر
 * ما بيعرفش إنه غلط لأن الخانة قبلت الكلام. المفتاح المش موجود
 * بيرجع لـ`badge-check` بدل ما يختفي.
 */
export const FEATURE_ICONS: Record<string, LucideIcon> = {
  truck: Truck,
  'credit-card': CreditCard,
  'rotate-ccw': RotateCcw,
  package: Package,
  'shield-check': ShieldCheck,
  'badge-check': BadgeCheck,
  headphones: Headphones,
  heart: Heart,
  gift: Gift,
  percent: Percent,
  sparkles: Sparkles,
  star: Star,
  lock: Lock,
  wallet: Wallet,
  leaf: Leaf,
  timer: Timer,
}

export const FEATURE_ICON_LABELS: Record<string, string> = {
  truck: 'شاحنة',
  'credit-card': 'بطاقة',
  'rotate-ccw': 'إرجاع',
  package: 'طرد',
  'shield-check': 'درع',
  'badge-check': 'توثيق',
  headphones: 'دعم',
  heart: 'قلب',
  gift: 'هدية',
  percent: 'خصم',
  sparkles: 'تميّز',
  star: 'نجمة',
  lock: 'قفل',
  wallet: 'محفظة',
  leaf: 'ورقة',
  timer: 'وقت',
}

export function FeaturesBlockView({ block, chrome }: { block: FeaturesBlock; chrome: BlockChrome }) {
  if (block.items.length === 0) return null

  const cols =
    block.columns === 2 ? 'sm:grid-cols-2' : block.columns === 3 ? 'sm:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'

  const boxed = block.style !== 'plain'

  return (
    <BlockShell background={block.background} chrome={chrome}>
      <BlockHead title={block.title} />

      <div className={`grid gap-4 ${block.columns === 4 ? '' : 'grid-cols-2'} ${cols}`}>
        {block.items.map((f, i) => {
          const Icon = FEATURE_ICONS[f.icon] ?? BadgeCheck
          return (
            <BlockItem key={f.id} chrome={chrome} index={i}>
              <div
                className={`flex h-full flex-col items-center gap-1.5 text-center ${
                  boxed
                    ? `rounded-[var(--sf-radius)] p-5 ${
                        block.style === 'card'
                          ? `bg-[var(--sf-surface)] shadow-sm ${hoverClass(chrome.effects)}`
                          : 'border border-[var(--sf-text)]/12'
                      }`
                    : ''
                }`}
              >
                <Icon className="h-6 w-6 text-[var(--sf-primary)]" aria-hidden="true" />
                <span className="text-sm font-semibold">{f.title}</span>
                {f.text && <span className="text-xs opacity-60">{f.text}</span>}
              </div>
            </BlockItem>
          )
        })}
      </div>
    </BlockShell>
  )
}

/* ────────────────────────── آراء العملاء ────────────────────────── */

export function TestimonialsBlockView({
  block,
  chrome,
}: {
  block: TestimonialsBlock
  chrome: BlockChrome
}) {
  if (block.items.length === 0) return null

  const carousel = block.layout === 'carousel'

  return (
    <BlockShell background={block.background} chrome={chrome}>
      <BlockHead title={block.title} />

      <div
        className={
          carousel
            ? 'scroll-x flex snap-x snap-mandatory gap-4 pb-2'
            : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
        }
      >
        {block.items.map((t, i) => (
          <BlockItem
            key={t.id}
            chrome={chrome}
            index={i}
            className={carousel ? 'w-[80%] shrink-0 snap-start sm:w-[45%] lg:w-[32%]' : ''}
          >
            <figure className="flex h-full flex-col gap-3 rounded-[var(--sf-radius)] bg-[var(--sf-surface)] p-5 shadow-sm">
              <Quote className="h-5 w-5 shrink-0 text-[var(--sf-primary)] opacity-40" aria-hidden="true" />

              <blockquote className="flex-1 text-sm leading-relaxed opacity-85">{t.text}</blockquote>

              <figcaption className="flex items-center gap-3 border-t border-[var(--sf-text)]/8 pt-3">
                {t.avatar ? (
                  <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[var(--sf-text)]/8">
                    <Image src={t.avatar} alt="" fill sizes="36px" className="object-cover" />
                  </span>
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sf-primary)]/12 text-sm font-bold text-[var(--sf-primary)]">
                    {t.name.trim().charAt(0) || '؟'}
                  </span>
                )}

                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{t.name}</span>
                  {t.rating > 0 && (
                    <span className="flex gap-0.5" aria-label={`${t.rating} من ٥`}>
                      {Array.from({ length: 5 }, (_, n) => (
                        <Star
                          key={n}
                          className={`h-3 w-3 ${
                            n < t.rating ? 'fill-current text-amber-500' : 'text-[var(--sf-text)]/20'
                          }`}
                          aria-hidden="true"
                        />
                      ))}
                    </span>
                  )}
                </span>
              </figcaption>
            </figure>
          </BlockItem>
        ))}
      </div>
    </BlockShell>
  )
}

/* ────────────────────────── الأسئلة الشائعة ────────────────────────── */

/**
 * الأكورديون بـ`<details>` الأصلي.
 *
 * من غير أي جافاسكربت: بيشتغل قبل ما الصفحة تحمّل، وقارئ الشاشة
 * بيعرفه، والبحث في المتصفح (Ctrl+F) بيلاقي الكلام المقفول ويفتحه.
 * الأكورديون المعمول بـReact بيخسر التلاتة.
 */
export function FaqBlockView({ block, chrome }: { block: FaqBlock; chrome: BlockChrome }) {
  if (block.items.length === 0) return null

  return (
    <BlockShell background={block.background} chrome={chrome}>
      <BlockHead title={block.title} />

      <div className="mx-auto flex max-w-3xl flex-col gap-2">
        {block.items.map((f, i) => (
          <BlockItem key={f.id} chrome={chrome} index={i}>
            <details className="group rounded-[var(--sf-radius)] border border-[var(--sf-text)]/12 bg-[var(--sf-surface)] open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-sm font-semibold [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown
                  className="h-4 w-4 shrink-0 opacity-50 transition-transform group-open:rotate-180"
                  aria-hidden="true"
                />
              </summary>
              <div className="px-4 pb-4 text-sm leading-relaxed opacity-75">{f.a}</div>
            </details>
          </BlockItem>
        ))}
      </div>
    </BlockShell>
  )
}

/* ────────────────────────── الفيديو ────────────────────────── */

const RATIO: Record<VideoBlock['ratio'], string> = {
  '16:9': 'aspect-video',
  '4:3': 'aspect-[4/3]',
  '1:1': 'aspect-square',
  '9:16': 'aspect-[9/16]',
}

/**
 * رابط التاجر بيتحوّل لرابط تضمين.
 *
 * التاجر بينسخ الرابط من شريط العنوان، مش من زرار «مشاركة ← تضمين».
 * الرابط العادي جوّه `<iframe>` بيرفض يفتح — يوتيوب بيمنع التأطير
 * عليه — فالتاجر بيلاقي مربّع أسود ومش عارف السبب.
 */
function embedUrl(raw: string): { kind: 'iframe' | 'file'; src: string } | null {
  const url = raw.trim()
  if (!url) return null

  const youtube = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/,
  )
  if (youtube) return { kind: 'iframe', src: `https://www.youtube-nocookie.com/embed/${youtube[1]}` }

  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vimeo) return { kind: 'iframe', src: `https://player.vimeo.com/video/${vimeo[1]}` }

  if (/\.(mp4|webm|ogg)(\?|$)/i.test(url)) return { kind: 'file', src: url }

  return null
}

export function VideoBlockView({ block, chrome }: { block: VideoBlock; chrome: BlockChrome }) {
  const embed = embedUrl(block.url)
  if (!embed) return null

  const width =
    block.width === 'narrow' ? 'mx-auto max-w-2xl' : block.width === 'full' ? 'max-w-none' : 'mx-auto max-w-4xl'

  return (
    <BlockShell background={block.background} chrome={chrome}>
      <div className={`flex flex-col gap-4 ${width}`}>
        <BlockHead title={block.title} subtitle={block.text} />

        <div className={`relative w-full overflow-hidden rounded-[var(--sf-radius)] bg-black ${RATIO[block.ratio]}`}>
          {embed.kind === 'iframe' ? (
            <iframe
              src={embed.src}
              title={block.title || 'فيديو'}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <video
              src={embed.src}
              poster={block.poster ?? undefined}
              controls
              playsInline
              preload="metadata"
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>
      </div>
    </BlockShell>
  )
}

/* ────────────────────────── الشعارات ────────────────────────── */

export function LogosBlockView({ block, chrome }: { block: LogosBlock; chrome: BlockChrome }) {
  const items = block.items.filter((l) => l.image)
  if (items.length === 0) return null

  const logo = (l: LogosBlock['items'][number], key: string) => {
    const img = (
      <Image
        src={l.image}
        alt={l.alt || ''}
        width={140}
        height={56}
        className={`h-10 w-auto object-contain transition-all sm:h-12 ${
          block.grayscale ? 'opacity-60 grayscale hover:opacity-100 hover:grayscale-0' : ''
        }`}
      />
    )

    return l.url ? (
      <Link key={key} href={l.url} className="shrink-0">
        {img}
      </Link>
    ) : (
      <span key={key} className="shrink-0">
        {img}
      </span>
    )
  }

  return (
    <BlockShell background={block.background} chrome={chrome} bleed={block.marquee} tight={block.marquee}>
      {block.marquee ? (
        <>
          {block.title && (
            <div className="mx-auto mb-5 max-w-6xl px-4 sm:px-6">
              <BlockHead title={block.title} />
            </div>
          )}
          {/*
            الشريط المتحرّك بيلفّ بلا نهاية عن طريق تكرار القايمة مرتين
            والرجوع لنص المسافة — نقطة الرجوع مطابقة للبداية بالظبط،
            فالعين ما تشوفش القفزة.

            و`aria-hidden` على النسخة التانية عشان قارئ الشاشة ما يقراش
            نفس الأسماء مرتين.
          */}
          <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
            <div
              className="sf-marquee gap-10 sm:gap-14"
              style={{ '--sf-marquee-dur': `${Math.max(18, items.length * 5)}s` } as React.CSSProperties}
            >
              {items.map((l) => logo(l, `a-${l.id}`))}
              <span className="flex gap-10 sm:gap-14" aria-hidden="true">
                {items.map((l) => logo(l, `b-${l.id}`))}
              </span>
            </div>
          </div>
        </>
      ) : (
        <>
          <BlockHead title={block.title} />
          <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            {items.map((l) => logo(l, l.id))}
          </div>
        </>
      )}
    </BlockShell>
  )
}

/* ────────────────────────── معرض الصور ────────────────────────── */

export function GalleryBlockView({ block, chrome }: { block: GalleryBlock; chrome: BlockChrome }) {
  const items = block.items.filter((g) => g.image)
  if (items.length === 0) return null

  const cols = block.columns === 2 ? 'sm:grid-cols-2' : block.columns === 4 ? 'sm:grid-cols-4' : 'sm:grid-cols-3'
  const hover = hoverClass(chrome.effects)

  const cell = (g: GalleryBlock['items'][number], i: number) => {
    /*
      الشلال بيدّي كل صورة ارتفاعها الطبيعي بدل ما يقصّها لمربّع.
      الشبكة المربّعة بتقصّ أطراف الصور، وده بيضرّ صور المنتجات
      الطولية أكتر من أي حاجة.
    */
    const ratio =
      block.layout === 'masonry' ? (i % 3 === 0 ? 'aspect-[3/4]' : 'aspect-square') : 'aspect-square'

    const inner = (
      <span
        className={`group relative block w-full overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6 ${ratio} ${hover}`}
      >
        <Image
          src={g.image}
          alt={g.caption || ''}
          fill
          sizes="(max-width: 640px) 50vw, 33vw"
          className="object-cover"
        />
        {block.showCaption && g.caption && (
          <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-sm font-medium text-white">
            {g.caption}
          </span>
        )}
      </span>
    )

    return g.url ? (
      <Link href={g.url} className="block">
        {inner}
      </Link>
    ) : (
      inner
    )
  }

  return (
    <BlockShell background={block.background} chrome={chrome}>
      <BlockHead title={block.title} />

      <div
        className={
          block.layout === 'strip'
            ? 'scroll-x flex snap-x snap-mandatory gap-4 pb-2'
            : `grid grid-cols-2 gap-4 ${cols}`
        }
      >
        {items.map((g, i) => (
          <BlockItem
            key={g.id}
            chrome={chrome}
            index={i}
            className={block.layout === 'strip' ? 'w-[62%] shrink-0 snap-start sm:w-[30%]' : ''}
          >
            {cell(g, i)}
          </BlockItem>
        ))}
      </div>
    </BlockShell>
  )
}
