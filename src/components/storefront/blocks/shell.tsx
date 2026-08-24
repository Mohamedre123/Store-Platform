import type { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { SLink as Link } from '../store-link'
import { Appear } from '../animate'
import { BG_CLASS, type BgKey } from '@/lib/blocks'
import type { EffectsSettings } from '@/lib/customization'

/**
 * الإطار المشترك لكل بلوك.
 *
 * كل بلوك بياخد نفس الهوامش ونفس العرض الأقصى ونفس شكل العنوان.
 * التاجر اللي بيركّب صفحة من عشر بلوكات مش مفروض يظبّط تباعد كل
 * واحد لوحده — الاتّساق ده هو الفرق بين صفحة مركّبة وصفحة مصمّمة.
 */

export type BlockChrome = {
  effects: EffectsSettings
  /** ترتيب البلوك في الصفحة — أول بلوكين ما بياخدوش حركة دخول */
  order: number
}

export function BlockShell({
  children,
  background = 'none',
  chrome,
  /** البلوكات اللي بتمتد لعرض الشاشة (بانر كامل، شرائح) */
  bleed,
  tight,
}: {
  children: ReactNode
  background?: BgKey
  chrome: BlockChrome
  bleed?: boolean
  tight?: boolean
}) {
  const inner = bleed ? (
    children
  ) : (
    <div className="mx-auto max-w-6xl px-4 sm:px-6">{children}</div>
  )

  return (
    <section className={`${BG_CLASS[background]} ${tight ? 'py-4 sm:py-5' : 'py-8 sm:py-12'}`}>
      {/*
        أول بلوك في الصفحة ما بياخدش حركة دخول: هو ظاهر قبل أي تمرير،
        فالحركة عليه بتأخّر أول حاجة العميل بيشوفها من غير فايدة.
      */}
      <Appear
        effect={chrome.effects.scroll}
        speed={chrome.effects.speed}
        disabled={chrome.order === 0}
      >
        {inner}
      </Appear>
    </section>
  )
}

/** عنوان البلوك وزر «المزيد» */
export function BlockHead({
  title,
  subtitle,
  moreLabel,
  moreHref,
}: {
  title?: string
  subtitle?: string
  moreLabel?: string
  moreHref?: string
}) {
  if (!title && !subtitle && !moreHref) return null

  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
      <div className="min-w-0">
        {title && <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>}
        {subtitle && <p className="mt-1 text-sm opacity-65 sm:text-base">{subtitle}</p>}
      </div>

      {moreHref && moreLabel && (
        <Link
          href={moreHref}
          className="group inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-[var(--sf-primary)] hover:underline"
        >
          {moreLabel}
          {/* السهم بيتحرّك ناحية اتجاه القراءة — يمين في العربي */}
          <ArrowLeft
            className="h-4 w-4 transition-transform group-hover:-translate-x-1"
            aria-hidden="true"
          />
        </Link>
      )}
    </div>
  )
}

/**
 * غلاف عنصر داخل بلوك — بيدّي التدرّج لما التاجر مفعّله.
 *
 * منفصل عن `BlockShell` عشان البلوك كله يظهر مرة واحدة والعناصر
 * جوّاه ورا بعض. لو حطّينا الاتنين مع بعض كان التدرّج هيتضاعف
 * والعنصر الأخير هياخد تانية كاملة عشان يبان.
 */
export function BlockItem({
  children,
  chrome,
  index,
  className = '',
}: {
  children: ReactNode
  chrome: BlockChrome
  index: number
  className?: string
}) {
  if (!chrome.effects.stagger || chrome.effects.scroll === 'none') {
    return <div className={className}>{children}</div>
  }

  return (
    <Appear
      effect={chrome.effects.scroll}
      speed={chrome.effects.speed}
      stagger
      index={index}
      className={className}
    >
      {children}
    </Appear>
  )
}

/** كلاسات التفاعل اللي التاجر بيتحكّم فيها من لوحة الحركة */
export function hoverClass(effects: EffectsSettings): string {
  return [effects.hoverLift ? 'sf-lift' : '', effects.imageZoom ? 'sf-zoom' : ''].filter(Boolean).join(' ')
}
