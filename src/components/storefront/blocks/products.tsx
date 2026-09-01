import { Package } from 'lucide-react'
import { SLink as Link } from '../store-link'
import { ProductCard } from '../product-card'
import { BlockHead, BlockItem, BlockShell, hoverClass, type BlockChrome } from './shell'
import type { ProductsBlock } from '@/lib/blocks'
import type { ListingSettings } from '@/lib/customization'
import type { StorefrontProduct } from '@/lib/storefront'
import type { ProductOptionSet } from '@/lib/product-options'

/**
 * بلوك المنتجات.
 *
 * ده البلوك اللي التاجر بيستعمله أكتر من أي حاجة، وعشان كده هو
 * الوحيد اللي بياخد كل الخيارات: منين ييجي المنتجات، بكام عمود،
 * بأي شكل بطاقة، وإيه اللي يحصل لما العميل يضغط.
 *
 * المنتجات نفسها بتتجاب في الصفحة لا هنا: البلوكات كلها بتتجاب مع
 * بعض في طلب واحد متوازي، بدل ما كل بلوك يفتح رحلة لقاعدة البيانات
 * لوحده وتتجمع الرحلات على بعضها في صفحة فيها ست بلوكات.
 */

/** أعمدة الشبكة — إعداد البلوك بيغلب إعداد صفحة المنتجات لو محدّد */
function gridClass(block: ProductsBlock, listing: ListingSettings): string {
  const desktop = block.columns || listing.columnsDesktop
  const mobile = listing.columnsMobile === 1 ? 'grid-cols-1' : 'grid-cols-2'
  const desk =
    desktop === 2
      ? 'md:grid-cols-2'
      : desktop === 3
        ? 'md:grid-cols-3'
        : desktop === 5
          ? 'md:grid-cols-5'
          : 'md:grid-cols-4'
  return `grid gap-4 sm:gap-5 ${mobile} ${desk}`
}

/**
 * عرض البطاقة الأفقي على الموبايل.
 *
 * الشبكة الرأسية بتخلّي العميل يعدّي بلوكات كتير قبل ما يوصل للتالي.
 * الشريط الأفقي بيخلّي البلوك ياخد صف واحد على الموبايل ويفضل
 * قابلًا للتصفّح — وده اللي متاجر الموبايل الكبيرة بتعمله.
 *
 * `scroll-snap` بيخلّي كل بطاقة تقف في مكانها بدل ما الشريط يفضل
 * سايح. من غيره التصفّح بيبان رخيص.
 */
const RAIL = 'scroll-x flex snap-x snap-mandatory gap-4 pb-2'
const RAIL_ITEM = 'w-[62%] shrink-0 snap-start sm:w-[38%] lg:w-[23%]'

export function ProductsBlockView({
  block,
  products,
  currency,
  listing,
  chrome,
  moreHref,
  optionSets,
}: {
  block: ProductsBlock
  products: StorefrontProduct[]
  currency: string
  listing: ListingSettings
  chrome: BlockChrome
  moreHref: string
  /** خيارات المنتجات اللي ليها خيارات — بتتجاب للصفحة كلها دفعة واحدة */
  optionSets?: Map<string, ProductOptionSet>
}) {
  if (products.length === 0) return null

  const cardProps = {
    currency,
    style: block.cardStyle === 'inherit' ? listing.cardStyle : block.cardStyle,
    imageRatio: block.imageRatio === 'inherit' ? listing.imageRatio : block.imageRatio,
    showRating: listing.showRating,
    action:
      block.action === 'inherit'
        ? (listing.cardAction ?? (listing.showQuickAdd ? 'add' : 'none'))
        : block.action,
  }

  /* الخيارات بتتمرّر في وضع «الخيارات على الكارت» بس */
  const optionsFor = (id: string) =>
    cardProps.action === 'choose' ? optionSets?.get(id) : undefined

  const hover = hoverClass(chrome.effects)

  return (
    <BlockShell background={block.background} chrome={chrome}>
      <BlockHead
        title={block.title}
        subtitle={block.subtitle}
        moreLabel={block.moreEnabled ? block.moreLabel : undefined}
        moreHref={block.moreEnabled ? moreHref : undefined}
      />

      {block.layout === 'carousel' ? (
        <div className={RAIL}>
          {products.map((p, i) => (
            <BlockItem key={p.id} chrome={chrome} index={i} className={RAIL_ITEM}>
              <ProductCard product={p} {...cardProps} optionSet={optionsFor(p.id)} className={hover} />
            </BlockItem>
          ))}
        </div>
      ) : block.layout === 'tiles' ? (
        <TileGrid
          products={products}
          cardProps={cardProps}
          chrome={chrome}
          hover={hover}
          optionsFor={optionsFor}
        />
      ) : (
        <div className={gridClass(block, listing)}>
          {products.map((p, i) => (
            <BlockItem key={p.id} chrome={chrome} index={i}>
              <ProductCard product={p} {...cardProps} optionSet={optionsFor(p.id)} className={hover} />
            </BlockItem>
          ))}
        </div>
      )}
    </BlockShell>
  )
}

/**
 * الفسيفساء: أول منتج بياخد مساحة مضاعفة.
 *
 * مش زينة — ده ترتيب بصري بيقول للعميل «ابدأ من هنا». الشبكة اللي
 * كل خاناتها متساوية بتسيب العين تلف من غير نقطة بداية، والتاجر
 * اللي عنده منتج بطل مش لاقي طريقة يبرزه بيه.
 *
 * على الموبايل بترجع شبكة عادية: المساحة المضاعفة في عمودين معناها
 * منتج واحد بياخد الشاشة كلها.
 */
function TileGrid({
  products,
  cardProps,
  chrome,
  hover,
  optionsFor,
}: {
  products: StorefrontProduct[]
  cardProps: Omit<React.ComponentProps<typeof ProductCard>, 'product'>
  chrome: BlockChrome
  hover: string
  optionsFor: (id: string) => ProductOptionSet | undefined
}) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:gap-5 md:grid-cols-4">
      {products.map((p, i) => (
        <BlockItem
          key={p.id}
          chrome={chrome}
          index={i}
          className={i === 0 ? 'md:col-span-2 md:row-span-2' : ''}
        >
          <ProductCard
            product={p}
            {...cardProps}
            optionSet={optionsFor(p.id)}
            className={hover}
            fill={i === 0}
          />
        </BlockItem>
      ))}
    </div>
  )
}

/** حالة «لسه مافيش منتجات» — بتظهر مرة واحدة في الصفحة لا مع كل بلوك */
export function EmptyStore() {
  return (
    <section className="mx-auto flex max-w-md flex-col items-center gap-3 px-4 py-24 text-center">
      <Package className="h-10 w-10 opacity-25" aria-hidden="true" />
      <h2 className="text-lg font-bold">لسه مافيش منتجات</h2>
      <p className="opacity-65">المتجر بيتجهّز. ارجع تاني قريب.</p>
      <Link href="/products" className="mt-2 text-sm font-medium text-[var(--sf-primary)] hover:underline">
        تصفّح المتجر
      </Link>
    </section>
  )
}
