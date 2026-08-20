import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { checkoutSettings, paymentMethods, products, productVariants, shippingRates, shippingZones, stores } from '@/db/schema'
import { applyBps } from './utils'
import { assignBucket, getRunningPriceExperiments, variantValue } from './experiments'

/**
 * حساب الطلب.
 *
 * القاعدة الحاكمة: **الأسعار تُقرأ من قاعدة البيانات لا من طلب العميل.**
 * المتصفح بيبعت معرّفات وكميات بس. لو اعتمدنا على السعر الجاي منه،
 * أي حد يقدر يشتري بسعر يكتبه بنفسه.
 */

export type CartLine = { productId: string; quantity: number; variantId?: string }

export type PricedLine = {
  productId: string
  /** المتغيّر المختار — سعره ومخزونه بيغلبوا بتوع المنتج */
  variantId?: string | null
  name: string
  slug: string
  image: string | null
  price: number
  costPrice: number | null
  quantity: number
  total: number
  available: number | null
}

export type Totals = {
  lines: PricedLine[]
  subtotal: number
  shipping: number
  codFee: number
  tax: number
  discount: number
  total: number
  costTotal: number
  freeShippingApplied: boolean
  freeShippingRemaining: number | null
}

export type CheckoutIssue =
  | { kind: 'empty' }
  | { kind: 'unavailable'; names: string[] }
  | { kind: 'out_of_stock'; names: string[] }
  | { kind: 'below_minimum'; minimum: number }

/**
 * تسعير السلة من قاعدة البيانات.
 *
 * `visitorId` بيستخدم في تجارب السعر بس: السعر المعروض للزائر لازم
 * يكون هو نفسه اللي بيتحاسب. عرض سعر ومحاسبة سعر تاني نصب مش تجربة.
 */
export async function priceCart(storeId: string, lines: CartLine[], visitorId?: string | null) {
  const ids = [...new Set(lines.map((l) => l.productId))].filter(Boolean)
  if (ids.length === 0) return { lines: [] as PricedLine[], issue: { kind: 'empty' } as CheckoutIssue }

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      slug: products.slug,
      images: products.images,
      price: products.price,
      costPrice: products.costPrice,
      stock: products.stock,
      trackInventory: products.trackInventory,
      status: products.status,
    })
    .from(products)
    .where(and(eq(products.storeId, storeId), inArray(products.id, ids)))

  const byId = new Map(rows.map((r) => [r.id, r]))

  // تجارب السعر الشغّالة — استعلام واحد لكل السلة
  const priceTests = visitorId ? await getRunningPriceExperiments(storeId, ids) : new Map()

  /**
   * المتغيّرات المطلوبة.
   *
   * سعر المتغيّر ومخزونه بيغلبوا بتوع المنتج: عميل اختار «أحمر XL»
   * لازم يدفع سعره ويتخصم من مخزونه هو — لا من مخزون المنتج العام.
   * وبنتأكد إن المتغيّر تابع للمتجر ده فعلًا، مش بس إن معرّفه صحيح.
   */
  const variantIds = [...new Set(lines.map((l) => l.variantId).filter(Boolean))] as string[]
  const variantRows = variantIds.length
    ? await db
        .select({
          id: productVariants.id,
          productId: productVariants.productId,
          title: productVariants.title,
          price: productVariants.price,
          costPrice: productVariants.costPrice,
          stock: productVariants.stock,
          image: productVariants.image,
          isActive: productVariants.isActive,
        })
        .from(productVariants)
        .where(
          and(eq(productVariants.storeId, storeId), inArray(productVariants.id, variantIds)),
        )
    : []
  const variantById = new Map(variantRows.map((v) => [v.id, v]))

  const priced: PricedLine[] = []
  const unavailable: string[] = []
  const outOfStock: string[] = []

  for (const line of lines) {
    const p = byId.get(line.productId)
    if (!p || p.status !== 'active') {
      if (p) unavailable.push(p.name)
      continue
    }

    // المتغيّر لازم يكون تابع لنفس المنتج — وإلا نتجاهله ونسعّر المنتج
    const variant = line.variantId ? variantById.get(line.variantId) : undefined
    const useVariant = variant && variant.productId === p.id && variant.isActive

    if (line.variantId && !useVariant) {
      unavailable.push(p.name)
      continue
    }

    /*
      سعر التجربة على المنتج بس لا على المتغيّر: سعر «أحمر XL» اختيار
      صريح من التاجر، وتجربة فوقه كانت هتخلّي مقاسين من نفس المنتج
      بأسعار مالهاش منطق ظاهر للعميل.
    */
    let price = useVariant ? variant.price : p.price
    if (!useVariant && visitorId) {
      const test = priceTests.get(p.id)
      if (test) {
        const alt = variantValue(test, assignBucket(visitorId, test.splitBps), 'price')
        if (typeof alt === 'number' && alt > 0) price = alt
      }
    }
    const costPrice = useVariant ? (variant.costPrice ?? p.costPrice) : p.costPrice
    const name = useVariant ? `${p.name} — ${variant.title}` : p.name

    // المتغيّر بيتتبّع مخزونه دايمًا؛ المنتج حسب إعداده
    const available = useVariant ? variant.stock : p.trackInventory ? p.stock : null

    if (available !== null && available <= 0) {
      outOfStock.push(name)
      continue
    }

    // الكمية المطلوبة تُقصّ على المتاح بدل رفض الطلب كله
    const quantity = Math.max(1, available !== null ? Math.min(line.quantity, available) : line.quantity)

    priced.push({
      productId: p.id,
      variantId: useVariant ? variant.id : null,
      name,
      slug: p.slug,
      image: (useVariant ? variant.image : null) ?? p.images[0] ?? null,
      price,
      costPrice,
      quantity,
      total: price * quantity,
      available,
    })
  }

  if (priced.length === 0) {
    return {
      lines: priced,
      issue: (outOfStock.length
        ? { kind: 'out_of_stock', names: outOfStock }
        : unavailable.length
          ? { kind: 'unavailable', names: unavailable }
          : { kind: 'empty' }) as CheckoutIssue,
    }
  }

  return { lines: priced, issue: null as CheckoutIssue | null }
}

/** سعر الشحن للمحافظة المختارة */
export async function shippingFor(storeId: string, country: string, city: string | null) {
  const [zone] = await db
    .select()
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.country, country)))
    .limit(1)

  if (!zone || !zone.enabled) {
    return { price: 0, minDays: null as number | null, maxDays: null as number | null, zone: null, available: false }
  }

  let price = zone.defaultPrice
  let minDays = zone.minDays
  let maxDays = zone.maxDays

  if (city) {
    const [rate] = await db
      .select()
      .from(shippingRates)
      .where(and(eq(shippingRates.zoneId, zone.id), eq(shippingRates.city, city)))
      .limit(1)

    if (rate?.enabled) {
      price = rate.price
      minDays = rate.minDays ?? minDays
      maxDays = rate.maxDays ?? maxDays
    }
  }

  return { price, minDays, maxDays, zone, available: true }
}

/** الإجمالي النهائي — مصدر الحقيقة الوحيد للمبالغ */
export async function computeTotals(options: {
  storeId: string
  lines: PricedLine[]
  country: string
  city: string | null
  paymentGateway: string | null
  discount?: number
  /** كوبون «شحن مجاني» بيصفّر الشحن بغض النظر عن حد الشحن المجاني */
  couponFreeShipping?: boolean
}): Promise<Totals> {
  const { storeId, lines, country, city, paymentGateway, discount = 0, couponFreeShipping = false } = options

  const subtotal = lines.reduce((n, l) => n + l.total, 0)
  const costTotal = lines.reduce((n, l) => n + (l.costPrice ?? 0) * l.quantity, 0)

  const ship = await shippingFor(storeId, country, city)
  const zone = ship.zone

  const freeThreshold = zone?.freeShippingEnabled ? zone.freeOverAmount : 0
  const freeShippingApplied = couponFreeShipping || Boolean(freeThreshold && subtotal - discount >= freeThreshold)
  const shipping = freeShippingApplied ? 0 : ship.price

  // رسوم أو خصم طريقة الدفع
  let codFee = 0
  if (paymentGateway) {
    const [method] = await db
      .select({ feeBps: paymentMethods.feeBps, fixedFee: paymentMethods.fixedFee })
      .from(paymentMethods)
      .where(and(eq(paymentMethods.storeId, storeId), eq(paymentMethods.gateway, paymentGateway)))
      .limit(1)

    if (method) codFee = applyBps(subtotal, method.feeBps) + method.fixedFee
  }

  const [store] = await db
    .select({ vatEnabled: stores.vatEnabled, vatRate: stores.vatRate, vatIncluded: stores.vatIncludedInPrice })
    .from(stores)
    .where(eq(stores.id, storeId))
    .limit(1)

  // الضريبة المضمّنة في السعر تُعرض للعلم ولا تُضاف للإجمالي
  const taxable = subtotal - discount
  const tax = store?.vatEnabled && !store.vatIncluded ? applyBps(taxable, store.vatRate) : 0

  return {
    lines,
    subtotal,
    shipping,
    codFee,
    tax,
    discount,
    total: Math.max(0, subtotal - discount + shipping + codFee + tax),
    costTotal,
    freeShippingApplied,
    freeShippingRemaining:
      freeThreshold && !freeShippingApplied ? Math.max(0, freeThreshold - (subtotal - discount)) : null,
  }
}

export async function getCheckoutSettings(storeId: string) {
  const [row] = await db
    .select()
    .from(checkoutSettings)
    .where(eq(checkoutSettings.storeId, storeId))
    .limit(1)

  return row ?? null
}

export async function getPaymentMethods(storeId: string) {
  return db
    .select({
      gateway: paymentMethods.gateway,
      displayName: paymentMethods.displayName,
      instructions: paymentMethods.instructions,
      feeBps: paymentMethods.feeBps,
      fixedFee: paymentMethods.fixedFee,
    })
    .from(paymentMethods)
    .where(and(eq(paymentMethods.storeId, storeId), eq(paymentMethods.enabled, true)))
    .orderBy(paymentMethods.sortOrder)
}
