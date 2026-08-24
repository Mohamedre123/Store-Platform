import Image from 'next/image'
import { SLink as Link } from '../store-link'
import { BlockItem, BlockShell, type BlockChrome } from './shell'
import type { BannerBlock, SlideItem } from '@/lib/blocks'

/**
 * بلوك البانر.
 *
 * صورة بنص وزر. التاجر بيقدر يحطّ أكتر من واحد جنب بعض — بانرين
 * نص ونص، أو تلاتة — من غير ما يحتاج بلوك جديد لكل واحد.
 *
 * ## صورتين لا واحدة
 * البانر العريض (١٩٢٠×٧٢٠) على موبايل بيتقص لعامود ضيّق في نصّه،
 * فالمنتج والنص بيروحوا برّه الكادر. `<picture>` بتخلّي المتصفح
 * يختار الصورة المناسبة قبل ما يحمّل — يعني الموبايل ما بيحمّلش
 * صورة الكمبيوتر أصلًا، فالصفحة بتفتح أسرع كمان.
 */

const HEIGHT: Record<BannerBlock['height'], string> = {
  sm: 'min-h-[9rem] sm:min-h-[11rem]',
  md: 'min-h-[13rem] sm:min-h-[18rem]',
  lg: 'min-h-[18rem] sm:min-h-[26rem]',
}

const POSITION: Record<SlideItem['textPosition'], string> = {
  start: 'items-center justify-start text-start',
  center: 'items-center justify-center text-center',
  end: 'items-center justify-end text-start',
}

export function BannerBlockView({
  block,
  chrome,
}: {
  block: BannerBlock
  chrome: BlockChrome
}) {
  const items = block.items.filter((b) => b.imageDesktop || b.imageMobile || b.heading)
  if (items.length === 0) return null

  const grid =
    items.length === 1
      ? 'grid-cols-1'
      : items.length === 2
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-3'

  const content = (
    <div className={`grid gap-4 ${grid}`}>
      {items.map((item, i) => (
        <BlockItem key={item.id} chrome={chrome} index={i}>
          <BannerCard item={item} height={block.height} rounded={block.rounded} />
        </BlockItem>
      ))}
    </div>
  )

  return (
    <BlockShell background="none" chrome={chrome} bleed={block.full} tight>
      {block.full ? <div className="px-0">{content}</div> : content}
    </BlockShell>
  )
}

export function BannerCard({
  item,
  height,
  rounded,
}: {
  item: SlideItem
  height: BannerBlock['height']
  rounded: boolean
}) {
  const desktop = item.imageDesktop ?? item.imageMobile
  const mobile = item.imageMobile ?? item.imageDesktop
  const hasText = Boolean(item.heading || item.text || item.ctaLabel)

  const body = (
    <>
      {desktop && (
        <picture>
          {/*
            المصدر الأول اللي شرطه يتحقّق هو اللي بيتحمّل. الترتيب
            مهم: الموبايل الأول عشان الشاشة الصغيرة ما تحمّلش الصورة
            العريضة وترميها.
          */}
          {mobile && <source media="(max-width: 639px)" srcSet={mobile} />}
          <Image
            src={desktop}
            alt={item.heading || ''}
            fill
            sizes="100vw"
            className="object-cover"
            priority={false}
          />
        </picture>
      )}

      {/* التعتيم بيخلّي النص مقروءًا فوق أي صورة */}
      {desktop && item.overlay > 0 && (
        <span
          className="absolute inset-0"
          style={{ background: `rgba(0,0,0,${item.overlay / 100})` }}
          aria-hidden="true"
        />
      )}

      {hasText && (
        <span
          className={`relative flex h-full w-full flex-col gap-3 p-6 sm:p-10 ${POSITION[item.textPosition]}`}
        >
          <span
            className="flex max-w-lg flex-col gap-2 rounded-[var(--sf-radius)]"
            style={
              item.blurEnabled && item.blur > 0
                ? {
                    /*
                      الضبابية خلف النص بس، مش على الصورة كلها: كده
                      النص بيبان والصورة تفضل واضحة — الضبابية على
                      الصورة كلها بتضيّع اللي التاجر رفعها عشانه.
                    */
                    backdropFilter: `blur(${item.blur}px)`,
                    WebkitBackdropFilter: `blur(${item.blur}px)`,
                    background: 'rgba(0,0,0,0.28)',
                    padding: '1rem 1.25rem',
                  }
                : undefined
            }
          >
            {item.heading && (
              <span
                className="text-xl font-bold leading-tight sm:text-3xl"
                style={{ color: item.textColor, fontFamily: 'var(--sf-font-heading)' }}
              >
                {item.heading}
              </span>
            )}
            {item.text && (
              <span className="text-sm sm:text-base" style={{ color: item.textColor, opacity: 0.9 }}>
                {item.text}
              </span>
            )}
            {item.ctaLabel && (
              <span
              className="mt-1 inline-flex w-fit items-center rounded-[var(--sf-radius)] px-5 py-2.5 text-sm font-semibold shadow-sm transition-transform group-hover:scale-[1.03]"
              style={{ background: item.ctaBg || 'var(--sf-primary)', color: item.ctaColor || '#ffffff' }}
            >
                {item.ctaLabel}
              </span>
            )}
          </span>
        </span>
      )}
    </>
  )

  const shell = `group relative flex overflow-hidden bg-[var(--sf-text)]/6 ${HEIGHT[height]} ${
    rounded ? 'rounded-[var(--sf-radius)]' : ''
  }`

  /*
    البانر كله رابط لما فيه وجهة. الزر جوّه بيفضل شكلًا لا عنصرًا —
    رابط جوّه رابط ترميز غير صالح، والمتصفح بيفكّه بطريقته.
  */
  if (item.ctaUrl) {
    return (
      <Link href={item.ctaUrl} className={shell}>
        {body}
      </Link>
    )
  }

  return <div className={shell}>{body}</div>
}
