import Image from 'next/image'
import { headers } from 'next/headers'
import { SLink as Link } from '@/components/storefront/store-link'
import { notFound } from 'next/navigation'
import { ChevronLeft, ImageOff, Truck, Undo2 } from 'lucide-react'
import {
  discountPercent,
  getProductBySlug,
  getStore,
  getStoreTheme,
  listProductReviews,
  listProducts,
  listPickedProducts,
} from '@/lib/storefront'
import { and, eq } from 'drizzle-orm'
import { db } from '@/db'
import { categories as categoriesTable, productOptionValues, productOptions, productVariants, wishlists } from '@/db/schema'
import { renderSeo } from '@/lib/seo-template'
import { formatMoney, decodeSlug } from '@/lib/utils'
import { cookies } from 'next/headers'
import { getCurrentCustomer } from '@/lib/customer-auth'
import {
  assignBucket,
  getRunningExperiment,
  trackExperimentView,
  variantValue,
} from '@/lib/experiments'
import { ProductCard } from '@/components/storefront/product-card'
import { ProductReviews } from '@/components/storefront/reviews'
import { WishlistButton } from '@/components/storefront/wishlist-button'
import { VariantPicker } from '@/components/storefront/variant-picker'
import { StickyBuyBar } from '@/components/storefront/sticky-buy-bar'
import { AddToCart } from '@/components/storefront/add-to-cart'
import { SlotPicker } from '@/components/storefront/slot-picker'
import type { QuickCheckoutSettings } from '@/components/storefront/quick-checkout'
import { getCheckoutSettings, getDisplayShipping, listPaymentOptions } from '@/lib/checkout'
import { regionsFor } from '@/lib/regions'
import { otpDeliverable } from '@/lib/order-otp'
import { publicStoreUrl } from '@/lib/domain'

export const dynamic = 'force-dynamic'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ store: string; slug: string }>
}) {
  const { store: identifier, slug: rawSlug } = await params
  const slug = decodeSlug(rawSlug)
  const store = await getStore(identifier)
  if (!store) return { title: 'المنتج' }

  const product = await getProductBySlug(store.id, slug)
  if (!product) return { title: 'المنتج مش موجود' }

  /*
    قوالب السيو بتتحلّ هنا لا وقت الحفظ: التاجر كتب «{Name} من
    {Brand}» مرة، ولو غيّر الاسم بكرة العنوان بيتغيّر معاه لوحده.
  */
  let categoryName: string | null = null
  if (product.categoryId) {
    const [c] = await db
      .select({ name: categoriesTable.name })
      .from(categoriesTable)
      .where(eq(categoriesTable.id, product.categoryId))
      .limit(1)
    categoryName = c?.name ?? null
  }

  const ctx = {
    name: product.name,
    category: categoryName,
    brand: product.brand,
    sku: product.sku,
    price: formatMoney(product.price, store.currency),
    store: store.name,
  }

  const title = renderSeo(product.seoTitle, ctx) || product.name
  const description =
    renderSeo(product.seoDescription, ctx) || product.shortDescription || undefined

  /*
    التاجر لما يكتب عنوان سيو، ده يبقى العنوان بالظبط.
    قالب التخطيط بيلحق «| اسم المتجر» بكل عنوان، فلو التاجر كتب
    {Store} في قالبه كان الاسم بيتكرر مرتين في نتيجة البحث. العنوان
    المكتوب بإيد التاجر أولى من قالب عام.
  */
  const hasCustomTitle = Boolean(renderSeo(product.seoTitle, ctx))

  return {
    title: hasCustomTitle ? { absolute: title } : title,
    description,
    openGraph: {
      title,
      description,
      images: product.images.length ? [{ url: product.images[0] }] : undefined,
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
    },
  }
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ store: string; slug: string }>
}) {
  const { store: identifier, slug: rawSlug } = await params
  const slug = decodeSlug(rawSlug)
  const store = await getStore(identifier)
  if (!store) notFound()

  const product = await getProductBySlug(store.id, slug)
  if (!product) notFound()

  const isPreview = (await headers()).get('x-zawya-preview') === '1'
  const theme = await getStoreTheme(store.id, isPreview)
  const { listing, productPage } = theme.custom

  /**
   * تجربة A/B على المنتج ده.
   *
   * المجموعة بتتحدد من معرّف الزائر اللي في الكوكي، فالسعر بيفضل
   * ثابت له مهما رجع للصفحة — وهو نفس المعرّف اللي التسعير بيستخدمه
   * وقت الشيك أوت، يعني اللي شافه هو اللي هيدفعه.
   *
   * مقفولة في المعاينة: التاجر بيفتح متجره كتير، ومشاهداته كانت
   * هتزوّر نتيجة تجربته هو.
   */
  const visitor = isPreview ? null : ((await cookies()).get('zw_v')?.value ?? null)
  const experiment = visitor ? await getRunningExperiment(store.id, product.id) : null
  const bucket = experiment && visitor ? assignBucket(visitor, experiment.splitBps) : null

  if (experiment && bucket) {
    // بدون await: القياس ما يصحّش يأخّر عرض الصفحة للعميل
    void trackExperimentView(experiment.id, bucket)
  }

  const testPrice = bucket ? variantValue(experiment, bucket, 'price') : null
  const testTitle = bucket ? variantValue(experiment, bucket, 'title') : null

  const displayName = typeof testTitle === 'string' && testTitle ? testTitle : product.name
  const displayPrice = typeof testPrice === 'number' && testPrice > 0 ? testPrice : product.price

  const off = discountPercent(displayPrice, product.compareAtPrice)
  const soldOut = product.trackInventory && product.stock <= 0
  const productReviews = await listProductReviews(product.id)

  /**
   * الخيارات والمتغيّرات.
   *
   * القيم بتتجاب في استعلام واحد وبتتجمّع في الذاكرة — استعلام لكل خيار
   * كان هيبقى N+1 على صفحة بيفتحها كل زائر.
   */
  const [optionRows, valueRows, variantRows] = await Promise.all([
    db
      .select({
        id: productOptions.id,
        name: productOptions.name,
        displayAs: productOptions.displayAs,
      })
      .from(productOptions)
      .where(eq(productOptions.productId, product.id))
      .orderBy(productOptions.position),
    db
      .select({
        id: productOptionValues.id,
        optionId: productOptionValues.optionId,
        value: productOptionValues.value,
        hex: productOptionValues.hex,
      })
      .from(productOptionValues)
      .innerJoin(productOptions, eq(productOptions.id, productOptionValues.optionId))
      .where(eq(productOptions.productId, product.id))
      .orderBy(productOptionValues.position),
    db
      .select({
        id: productVariants.id,
        title: productVariants.title,
        price: productVariants.price,
        compareAtPrice: productVariants.compareAtPrice,
        stock: productVariants.stock,
        image: productVariants.image,
        optionValueIds: productVariants.optionValueIds,
      })
      .from(productVariants)
      .where(
        and(eq(productVariants.productId, product.id), eq(productVariants.isActive, true)),
      )
      .orderBy(productVariants.position),
  ])

  const pickerOptions = optionRows.map((o) => ({
    ...o,
    values: valueRows.filter((v) => v.optionId === o.id),
  }))

  // حالة المفضّلة للعميل المسجّل — العميل الزائر بيشوف القلب فاضي
  const customer = await getCurrentCustomer(store.id)
  let isSaved = false
  if (customer) {
    const [row] = await db
      .select({ id: wishlists.id })
      .from(wishlists)
      .where(and(eq(wishlists.customerId, customer.id), eq(wishlists.productId, product.id)))
      .limit(1)
    isSaved = Boolean(row)
  }

  /**
   * المقترحات: اختيار التاجر الأول، والتلقائي احتياطي.
   *
   * الاقتراح من نفس القسم بيشتغل من غير أي إعداد — وده اللي بيخلّي
   * المتجر بألف منتج يبقى فيه اقتراحات من أول يوم. لكنه ما بيعرفش
   * إن الجراب ده بتاع الموبايل ده بالذات. لما التاجر يختار، اختياره
   * بيغلب.
   *
   * والترقية منفصلة عن المرتبطة: المرتبطة بتتعرض تحت («خد ده كمان»)،
   * والترقية جنب زرار الشرا («الأفضل منه بكام زيادة»). خلطهم في قايمة
   * واحدة بيضيّع الاتنين.
   */
  const [picked, upsells] = await Promise.all([
    listPickedProducts(store.id, product.relatedProductIds ?? []),
    listPickedProducts(store.id, product.upsellProductIds ?? []),
  ])

  const related = picked.length
    ? picked.filter((p) => p.id !== product.id).slice(0, 4)
    : (await listProducts(store.id, { categoryId: product.categoryId ?? undefined, limit: 5 }))
        .filter((p) => p.id !== product.id)
        .slice(0, 4)

  /* الترقية اللي أغلى من المنتج بس — «رقّي لأرخص» مالهاش معنى */
  const upgrades = upsells.filter((p) => p.id !== product.id && p.price > product.price).slice(0, 3)

  /**
   * الدفع السريع.
   *
   * الإعداد كان موجود في لوحة التاجر من غير أي حاجة ترسمه — يشغّله
   * ويقفله وما يتغيّرش حرف في متجره. القراية هنا هي اللي بتوصّله
   * لصفحة المنتج.
   *
   * الشحن وطرق الدفع ما بيتقروش غير لما يكون مشغّلًا: صفحة المنتج
   * بيفتحها كل زائر، والمتجر اللي قافل الميزة ما يصحّش يدفع تمنها.
   */
  const quickSettings = await getCheckoutSettings(store.id)

  /**
   * الطلب على واتساب — إعداد التاجر ورقمه مع بعض.
   *
   * الاتنين شرط: الإعداد مفتوح **و** فيه رقم واتساب على المتجر. زرار
   * بيفتح محادثة على رقم فاضي أسوأ من زرار مش موجود.
   */
  const whatsappOrderNumber =
    (quickSettings?.whatsappOrderEnabled ?? false) && store.whatsapp ? store.whatsapp : null

  /* رابط المنتج للرسالة — بنطاق التاجر لو ربطه */
  const productUrl = whatsappOrderNumber
    ? `${await publicStoreUrl(store)}/products/${encodeURIComponent(product.slug)}`
    : null

  const quick =
    (quickSettings?.quickCheckoutEnabled ?? true) && store.isPublished
      ? await (async () => {
          /*
            طرق الدفع محتاجة تعرف الدفع عند الاستلام مفتوح ولا لأ،
            ومفتاحه في إعداد الشحن — فترتيبهم هنا تبعية حقيقية لا
            انتظار مالوش لازمة.
          */
          const ship = await getDisplayShipping(store.id, store.country)
          return {
            storeIdentifier: identifier,
            currency: store.currency,
            country: store.country,
            style: quickSettings?.quickCheckoutStyle ?? 'drawer',
            showItems: quickSettings?.quickCheckoutShowItems ?? true,
            regions: regionsFor(store.country),
            payments: await listPaymentOptions(store.id, ship.codEnabled),
            shipping: {
              byCity: ship.byCity,
              defaultPrice: ship.defaultPrice,
              freeOver: ship.freeOver,
            },
            addressMode: quickSettings?.addressMode ?? 'structured',
            fieldName: quickSettings?.fieldName ?? 'required',
            fieldCity: quickSettings?.fieldCity ?? 'required',
            fieldArea: quickSettings?.fieldArea ?? 'optional',
            fieldStreet: quickSettings?.fieldStreet ?? 'required',
            fieldBuilding: quickSettings?.fieldBuilding ?? 'optional',
            otpEnabled: quickSettings?.otpEnabled ?? true,
            otpDeliverable: await otpDeliverable(store.id),
            minOrderEnabled: quickSettings?.minOrderEnabled ?? false,
            minOrderAmount: quickSettings?.minOrderAmount ?? 0,
            /*
              بيانات الحساب — و`null` معناها ضيف. الزرار ساعتها بيضيف
              للسلة ويوصّله لشاشة الدخول بدل ما يوريه نموذجًا الخادم
              هيرفضه في آخره.
            */
            account: customer
              ? { name: customer.name, phone: customer.phone, email: customer.email }
              : null,
          } satisfies QuickCheckoutSettings
        })()
      : null

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
      {/* مسار التنقّل */}
      <nav className="mb-6 flex items-center gap-1 text-sm opacity-65">
        <Link href="/" className="hover:opacity-100">
          الرئيسية
        </Link>
        <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/products" className="hover:opacity-100">
          المنتجات
        </Link>
      </nav>

      <div className="grid gap-8 md:grid-cols-2 md:gap-12">
        {/*
          الصور — تخطيط المعرض من إعداد التاجر:
          stacked = كل الصور تحت بعض · thumbs-side = مصغّرات جنب الصورة
          thumbs-bottom = مصغّرات تحتها
        */}
        <div
          className={
            productPage.galleryLayout === 'thumbs-side' && product.images.length > 1
              ? 'flex flex-row-reverse gap-3'
              : 'flex flex-col gap-3'
          }
        >
          <div className="flex flex-1 flex-col gap-3">
            <div className="relative aspect-square w-full overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6">
              {product.images[0] ? (
                <Image
                  src={product.images[0]}
                  alt={product.name}
                  fill
                  priority
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full items-center justify-center opacity-25">
                  <ImageOff className="h-10 w-10" aria-hidden="true" />
                </span>
              )}
              {off && !soldOut && (
                <span className="absolute start-3 top-3 rounded-md bg-[var(--sf-primary)] px-2 py-1 text-sm font-bold text-white tabular-nums">
                  خصم {off}%
                </span>
              )}
            </div>

            {/* المكدّس: باقي الصور بحجمها الكامل تحت بعض */}
            {productPage.galleryLayout === 'stacked' &&
              product.images.slice(1).map((src) => (
                <div
                  key={src}
                  className="relative aspect-square w-full overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6"
                >
                  <Image src={src} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                </div>
              ))}
          </div>

          {productPage.galleryLayout !== 'stacked' && product.images.length > 1 && (
            <div
              className={
                productPage.galleryLayout === 'thumbs-side'
                  ? 'flex w-20 shrink-0 flex-col gap-2 overflow-y-auto'
                  : 'scroll-x flex gap-2'
              }
            >
              {product.images.slice(1).map((src) => (
                <span
                  key={src}
                  className="relative h-20 w-20 shrink-0 overflow-hidden rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6"
                >
                  <Image src={src} alt="" fill sizes="80px" className="object-cover" />
                </span>
              ))}
            </div>
          )}
        </div>

        {/* التفاصيل */}
        <div className="flex flex-col gap-5">
          <h1 className="text-balance text-2xl font-bold tracking-tight sm:text-3xl">{product.name}</h1>

          {productPage.showSku && product.sku && (
            <span className="-mt-2 text-xs text-[var(--sf-text)]/50">
              كود المنتج: <bdi dir="ltr">{product.sku}</bdi>
            </span>
          )}

          {/*
            الخدمة بتتحجز بمعاد لا بكمية.

            المنتقي بيظهر فوق زرار الإضافة عشان العميل يختار معاده
            الأول — لو ظهر تحته، هيضيف للسلة وينسى المعاد، ويوصل
            الشيك أوت بحجز بلا وقت.
          */}
          {store.bookingsEnabled && product.type === 'service' && (
            <SlotPicker
              storeIdentifier={identifier}
              productId={product.id}
              accent={theme.custom.identity.primary}
            />
          )}

          {/*
            المنتج اللي ليه متغيّرات، السعر والمخزون والإضافة للسلة كلها
            بتتحكّم من المنتقي — لأن القيم دي بتتغيّر مع كل اختيار.
          */}
          {pickerOptions.length > 0 && variantRows.length > 0 ? (
            <div className="flex items-stretch gap-2">
              <div className="min-w-0 flex-1">
                <VariantPicker
                  options={pickerOptions}
                  variants={variantRows}
                  fallback={{
                    productId: product.id,
                    name: displayName,
                    slug: product.slug,
                    image: product.images[0],
                    price: displayPrice,
                  }}
                  currency={store.currency}
                  whatsapp={productPage.showWhatsappAsk ? store.whatsapp : null}
                  whatsappOrder={whatsappOrderNumber}
                  productUrl={productUrl}
                  showStockCounter={productPage.showStockCounter}
                  quick={quick}
                />
              </div>
              <WishlistButton
                storeIdentifier={identifier}
                productId={product.id}
                initialSaved={isSaved}
              />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="tabular text-3xl font-bold text-[var(--sf-primary)]">
                  {formatMoney(displayPrice, store.currency)}
                </span>
                {product.compareAtPrice && (
                  <span className="tabular text-lg line-through opacity-45">
                    {formatMoney(product.compareAtPrice, store.currency)}
                  </span>
                )}
              </div>

              {productPage.showStockCounter &&
                product.trackInventory &&
                product.stock > 0 &&
                product.stock <= 10 && (
                  <p className="text-sm font-medium text-amber-600">
                    باقي <span className="tabular">{product.stock}</span> بس في المخزن
                  </p>
                )}

              <div className="flex items-stretch gap-2">
                <div className="min-w-0 flex-1">
                  <AddToCart
                    item={{
                      productId: product.id,
                      name: displayName,
                      slug: product.slug,
                      image: product.images[0],
                      price: displayPrice,
                      maxStock: product.trackInventory ? product.stock : undefined,
                    }}
                    soldOut={soldOut}
                    whatsapp={productPage.showWhatsappAsk ? store.whatsapp : null}
                  whatsappOrder={whatsappOrderNumber}
                  productUrl={productUrl}
                    productName={product.name}
                    quick={quick}
                  />
                </div>
                <WishlistButton
                  storeIdentifier={identifier}
                  productId={product.id}
                  initialSaved={isSaved}
                />
              </div>

              {/*
                الترقية — جنب زرار الشرا لا في آخر الصفحة.

                العميل بيقرّر هنا. لو حطّينا «فيه أحسن منه» تحت المراجعات،
                هو خلاص يا اشترى يا مشي — والاقتراح بيوصل بعد القرار.

                والفرق في السعر مكتوب صريح: «بـ٦٠ جنيه زيادة» بتتقرا أسهل
                من رقمين العميل يطرحهم بنفسه.
              */}
              {upgrades.length > 0 && (
                <div className="flex flex-col gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-primary)]/25 bg-[var(--sf-primary)]/[0.04] p-3">
                  <span className="text-xs font-semibold text-[var(--sf-primary)]">
                    فيه أحسن منه
                  </span>
                  {upgrades.map((u) => (
                    <Link
                      key={u.id}
                      href={`/products/${u.slug}`}
                      className="flex items-center gap-3 rounded-[var(--sf-radius)] p-1.5 transition-colors hover:bg-[var(--sf-surface)]"
                    >
                      {u.images[0] ? (
                        <Image
                          src={u.images[0]}
                          alt=""
                          width={44}
                          height={44}
                          className="h-11 w-11 shrink-0 rounded-[var(--sf-radius)] object-cover"
                        />
                      ) : (
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--sf-radius)] bg-[var(--sf-text)]/6">
                          <ImageOff className="h-4 w-4 opacity-40" aria-hidden="true" />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{u.name}</span>
                        <span className="tabular text-xs opacity-70">
                          بـ{formatMoney(u.price - displayPrice, store.currency)} زيادة
                        </span>
                      </span>
                      <ChevronLeft className="h-4 w-4 shrink-0 opacity-40" aria-hidden="true" />
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {(productPage.showShippingNote || productPage.showReturnNote || productPage.trustLines.length > 0) && (
            <div className="flex flex-col gap-2 rounded-[var(--sf-radius)] border border-[var(--sf-text)]/10 p-4 text-sm">
              {productPage.showShippingNote && (
                <span className="flex items-center gap-2">
                  <Truck className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
                  {productPage.trustLines[0] || 'التوصيل لكل المحافظات · الدفع عند الاستلام متاح'}
                </span>
              )}
              {productPage.showReturnNote && (
                <span className="flex items-center gap-2">
                  <Undo2 className="h-4 w-4 shrink-0 text-[var(--sf-primary)]" aria-hidden="true" />
                  {productPage.trustLines[1] || 'إرجاع سهل لو المنتج مش زي ما توقّعت'}
                </span>
              )}
            </div>
          )}

          {product.description && (
            <div className="border-t border-[var(--sf-text)]/10 pt-5">
              <h2 className="mb-2 font-bold">تفاصيل المنتج</h2>
              <p className="whitespace-pre-line leading-relaxed opacity-80">{product.description}</p>
            </div>
          )}

          {product.specs.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-[var(--sf-text)]/10 pt-5 text-sm">
              {product.specs.map((s) => (
                <div key={s.key} className="flex flex-col">
                  <dt className="opacity-60">{s.key}</dt>
                  <dd className="font-medium">{s.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      <ProductReviews
        storeIdentifier={identifier}
        productId={product.id}
        reviews={productReviews}
        ratingAverage={product.ratingCount > 0 ? product.ratingSum / product.ratingCount : null}
        ratingCount={product.ratingCount}
      />

      {productPage.showRelated && related.length > 0 && (
        <section className="mt-16">
          <h2 className="mb-6 text-xl font-bold tracking-tight">{productPage.relatedTitle || 'منتجات ممكن تعجبك'}</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                currency={store.currency}
                style={listing.cardStyle === 'compact' ? 'clean' : listing.cardStyle}
                imageRatio={listing.imageRatio}
              />
            ))}
          </div>
        </section>
      )}
      {/* شريط الشراء الثابت — بس لو التاجر فعّله ومفيش متغيّرات
          (المنتج بمتغيّرات محتاج اختيار قبل الإضافة) */}
      {productPage.stickyBuyBarOnMobile && pickerOptions.length === 0 && (
        <StickyBuyBar
          item={{
            productId: product.id,
            name: displayName,
            slug: product.slug,
            image: product.images[0],
            price: displayPrice,
            maxStock: product.trackInventory ? product.stock : undefined,
          }}
          soldOut={soldOut}
          currency={store.currency}
          hasMobileNav={theme.custom.toolbar.mobileNavEnabled}
        />
      )}

    </div>
  )
}
