import Image from 'next/image'
import { Package } from 'lucide-react'
import { SLink as Link } from '../store-link'
import { BlockHead, BlockItem, BlockShell, hoverClass, type BlockChrome } from './shell'
import type { CategoriesBlock } from '@/lib/blocks'

export type CategoryRow = {
  id: string
  name: string
  slug: string
  image: string | null
  productCount: number
}

/**
 * بلوك الأقسام.
 *
 * تلات أشكال بتخدم غرضين مختلفين:
 *  - `circle`: شريط دواير صغيّر — الشكل اللي العميل متعوّد عليه من
 *    تطبيقات الموبايل، بياخد مساحة قليلة وبيوصّل «فيه أقسام هنا».
 *  - `card`: كارت بصورة واسم — لما الأقسام قليلة والصور حلوة.
 *  - `tile`: الاسم فوق الصورة — أقوى بصريًا، للمتاجر اللي أقسامها
 *    هي المنتج نفسه (مجموعات، ماركات).
 *
 * وعلى الموبايل كلهم بيبقوا شريط أفقي: صف واحد بيتصفّح أحسن من
 * شبكة بتطوّل الصفحة قبل ما العميل يشوف أول منتج.
 */
export function CategoriesBlockView({
  block,
  categories,
  chrome,
  radiusFull,
}: {
  block: CategoriesBlock
  categories: CategoryRow[]
  chrome: BlockChrome
  /** حواف الثيم دايرة بالكامل؟ الدواير بتتبعها */
  radiusFull: boolean
}) {
  /* الاختيار اليدوي بيتعرض بترتيب التاجر لا بترتيب قاعدة البيانات */
  const picked = block.categoryIds.length
    ? (block.categoryIds.map((id) => categories.find((c) => c.id === id)).filter(Boolean) as CategoryRow[])
    : categories

  const items = picked.slice(0, block.limit)
  if (items.length === 0) return null

  const cols =
    block.columns === 3
      ? 'sm:grid-cols-3'
      : block.columns === 4
        ? 'sm:grid-cols-4'
        : block.columns === 5
          ? 'sm:grid-cols-5'
          : 'sm:grid-cols-4 lg:grid-cols-6'

  const hover = hoverClass(chrome.effects)

  return (
    <BlockShell background={block.background} chrome={chrome}>
      <BlockHead title={block.title} subtitle={block.subtitle} />

      <div className={`rail-sm flex gap-4 pb-2 sm:grid ${cols}`}>
        {items.map((c, i) => (
          <BlockItem key={c.id} chrome={chrome} index={i} className="w-28 shrink-0 sm:w-auto">
            {block.layout === 'tile' ? (
              <Tile category={c} showCount={block.showCount} hover={hover} />
            ) : (
              <Simple
                category={c}
                round={block.layout === 'circle' || radiusFull}
                card={block.layout === 'card'}
                showCount={block.showCount}
                hover={hover}
              />
            )}
          </BlockItem>
        ))}
      </div>
    </BlockShell>
  )
}

function Simple({
  category: c,
  round,
  card,
  showCount,
  hover,
}: {
  category: CategoryRow
  round: boolean
  card: boolean
  showCount: boolean
  hover: string
}) {
  return (
    <Link
      href={`/category/${c.slug}`}
      className={`group flex flex-col items-center gap-2 ${
        card ? `rounded-[var(--sf-radius)] border border-[var(--sf-text)]/10 bg-[var(--sf-surface)] p-3 ${hover}` : ''
      }`}
    >
      <span
        className={`relative block aspect-square w-full overflow-hidden bg-[var(--sf-text)]/6 ${
          round ? 'rounded-full' : 'rounded-[var(--sf-radius)]'
        } ${card ? '' : hover}`}
      >
        <Placeholder image={c.image} />
      </span>

      <span className="text-center text-sm font-medium">{c.name}</span>
      {showCount && (
        <span className="tabular text-xs opacity-55">{c.productCount} منتج</span>
      )}
    </Link>
  )
}

function Tile({
  category: c,
  showCount,
  hover,
}: {
  category: CategoryRow
  showCount: boolean
  hover: string
}) {
  return (
    <Link
      href={`/category/${c.slug}`}
      className={`group relative block aspect-square w-full overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6 ${hover}`}
    >
      <Placeholder image={c.image} />
      {/*
        التدرّج مش زينة: الاسم الأبيض على صورة فاتحة ما بيتقراش خالص،
        والتاجر مش بيلاحظ لأنه شايف صورته هو اللي عارف فيها إيه.
      */}
      <span className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 bg-gradient-to-t from-black/75 to-transparent p-3 pt-10 text-white">
        <span className="text-sm font-semibold">{c.name}</span>
        {showCount && <span className="tabular text-xs opacity-80">{c.productCount} منتج</span>}
      </span>
    </Link>
  )
}

function Placeholder({ image }: { image: string | null }) {
  if (!image) {
    return (
      <span className="flex h-full items-center justify-center opacity-25">
        <Package className="h-6 w-6" aria-hidden="true" />
      </span>
    )
  }

  return (
    <Image
      src={image}
      alt=""
      fill
      sizes="(max-width: 640px) 30vw, 180px"
      className="object-cover"
    />
  )
}
