import 'server-only'
import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { carrierAccounts, checkoutSettings, paymentMethods, productOptions, productOptionValues, products, productVariants, shippingRates, shippingZones, stores } from '@/db/schema'
import { applyBps } from './utils'
import { assignBucket, getRunningPriceExperiments, variantValue } from './experiments'
import { paymentProvider } from './providers'
import type { PaymentOption } from './checkout-ui'

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
  /** اسم المنتج لوحده من غير المقاس — للفواتير والجداول */
  productName: string
  /** «أحمر / XL» — عنوان المتغيّر زي ما التاجر سمّاه */
  variantTitle: string | null
  /**
   * الخيارات مفكوكة: المقاس = XL، اللون = أحمر.
   *
   * الاسم المدموج «تيشيرت — أحمر / XL» بيتقرا، لكن ما ينفعش يتفرز
   * ولا يتبحث فيه ولا يتحط في بوليصة شحن. اللي بيغلّف الطلب بيدوّر
   * على «المقاس» — مش على جزء من سطر نص.
   */
  options: Array<{ name: string; value: string }>
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
  /** منتج ليه مقاسات أو ألوان والعميل ما اختارش */
  | { kind: 'needs_options'; names: string[] }

/**
 * «المقاس → XL» لمجموعة معرّفات قيم.
 *
 * المتغيّر مخزَّن كمعرّفات قيم بس (`optionValueIds`)، وعنوانه المدموج
 * «أحمر / XL» مالوش تفصيل. الفاتورة وبوليصة الشحن محتاجين الاتنين:
 * اسم الخيار وقيمته، كل واحد لوحده.
 */
async function loadOptionLabels(
  valueIds: string[],
): Promise<Map<string, { name: string; value: string; position: number }>> {
  const ids = [...new Set(valueIds)].filter(Boolean)
  const out = new Map<string, { name: string; value: string; position: number }>()
  if (ids.length === 0) return out

  const rows = await db
    .select({
      id: productOptionValues.id,
      value: productOptionValues.value,
      name: productOptions.name,
      position: productOptions.position,
    })
    .from(productOptionValues)
    .innerJoin(productOptions, eq(productOptions.id, productOptionValues.optionId))
    .where(inArray(productOptionValues.id, ids))

  for (const r of rows) out.set(r.id, { name: r.name, value: r.value, position: r.position })
  return out
}

/**
 * تسعير السلة من قاعدة البيانات.
 *
 * `visitorId` بيستخدم في تجارب السعر بس: السعر المعروض للزائر لازم
 * يكون هو نفسه اللي بيتحاسب. عرض سعر ومحاسبة سعر تاني نصب مش تجربة.
 */
export async function priceCart(
  storeId: string,
  lines: CartLine[],
  visitorId?: string | null,
  opts?: {
    /**
     * يسمح بسطر منتج ليه مقاسات والعميل ما اختارش.
     *
     * للسلة المتروكة بس. الطلب الحقيقي بيترفض — لكن السلة المتروكة
     * هدفها إن التاجر يشوف اللي حصل، و«حطّ تيشيرت ومختارش المقاس»
     * دي أهم معلومة فيها. لو رمينا السطر ده، السلة بتتحفظ فاضية أو
     * ما بتتحفظش أصلًا، والتاجر ما يعرفش إن حد كان قرّب يشتري.
     */
    keepMissingOptions?: boolean
  },
) {
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
          optionValueIds: productVariants.optionValueIds,
        })
        .from(productVariants)
        .where(
          and(eq(productVariants.storeId, storeId), inArray(productVariants.id, variantIds)),
        )
    : []
  const variantById = new Map(variantRows.map((v) => [v.id, v]))

  /**
   * أسماء الخيارات وقيمها للمتغيّرات اللي في السلة.
   *
   * استعلام واحد لكل السلة: العميل اللي شارى تلات مقاسات ما يستاهلش
   * تلات رحلات. والنتيجة بتتخزّن على سطر الطلب كلقطة — لو التاجر
   * غيّر اسم الخيار من «المقاس» لـ«الحجم» بعدين، الطلب القديم يفضل
   * مكتوب فيه اللي العميل شافه وقت الشرا.
   */
  const optionLabels = await loadOptionLabels(
    variantRows.flatMap((v) => v.optionValueIds ?? []),
  )

  /**
   * المنتجات اللي ليها مقاسات والسطر جاي من غير اختيار.
   *
   * العميل بيقدر يضيف من على البطاقة بضغطة واحدة، فالسطر بيوصل هنا
   * بلا متغيّر. لو عدّى كده، التاجر بيستلم طلبًا مكتوب فيه «تيشيرت»
   * من غير مقاس — فيتصل بالعميل يسأله، أو يبعت مقاسًا بالتخمين
   * ويرجع له.
   *
   * فبنوقف الطلب هنا ونقول له يختار. والسلة نفسها بتوريه الخيارات
   * في مكانها عشان ما يضطرش يرجع لصفحة المنتج.
   */
  const bareIds = [...new Set(lines.filter((l) => !l.variantId).map((l) => l.productId))]
  const needsOptions = new Set<string>()

  if (bareIds.length) {
    const rows = await db
      .selectDistinct({ productId: productVariants.productId })
      .from(productVariants)
      .where(
        and(
          eq(productVariants.storeId, storeId),
          eq(productVariants.isActive, true),
          inArray(productVariants.productId, bareIds),
        ),
      )
    for (const r of rows) needsOptions.add(r.productId)
  }

  const priced: PricedLine[] = []
  const unavailable: string[] = []
  const outOfStock: string[] = []
  const missingOptions: string[] = []

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

    const optionsMissing = !line.variantId && needsOptions.has(p.id)
    if (optionsMissing) {
      missingOptions.push(p.name)
      if (!opts?.keepMissingOptions) continue
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

    /* الخيارات مرتّبة بترتيب التاجر — «المقاس» قبل «اللون» لو هو رتّبهم كده */
    const options = useVariant
      ? (variant.optionValueIds ?? [])
          .map((id) => optionLabels.get(id))
          .filter((o): o is NonNullable<typeof o> => Boolean(o))
          .sort((a, b) => a.position - b.position)
          .map((o) => ({ name: o.name, value: o.value }))
      : []

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
      productName: p.name,
      variantTitle: useVariant ? variant.title : null,
      options,
      slug: p.slug,
      image: (useVariant ? variant.image : null) ?? p.images[0] ?? null,
      price,
      costPrice,
      quantity,
      total: price * quantity,
      available,
    })
  }

  /*
    «اختار المقاس» بيسبق أي رسالة تانية: هي الوحيدة اللي العميل يقدر
    يصلّحها بضغطة، والباقي بيحتاج يغيّر سلته. وبتتقال حتى لو باقي
    السطور سليمة — الطلب اللي بينقصه مقاس ما ينفعش يعدّي نُصّه.
  */
  if (missingOptions.length && !opts?.keepMissingOptions) {
    return { lines: priced, issue: { kind: 'needs_options', names: missingOptions } as CheckoutIssue }
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
/**
 * سعر الشحن.
 *
 * **الشركة المربوطة بتغلب التسعير اليدوي.** لو التاجر ربط شركة،
 * سعرها هو اللي بيتحسب — ولو سبنا اليدوي شغّالًا معاها، العميل ياخد
 * سعرًا والتاجر يتحاسب بسعر تاني والفرق من جيبه في كل طلب.
 *
 * ولو الشركة مالهاش سعر مسجّل، بنرجع للتسعير اليدوي بدل ما نخلّي
 * الشحن بصفر — الصفر هنا معناه التاجر بيشحن ببلاش من غير ما يقصد.
 */
export async function shippingFor(storeId: string, country: string, city: string | null) {
  const [carrier] = await db
    .select({
      name: carrierAccounts.displayName,
      carrier: carrierAccounts.carrier,
      flatRate: carrierAccounts.flatRate,
      freeOver: carrierAccounts.freeOver,
    })
    .from(carrierAccounts)
    .where(and(eq(carrierAccounts.storeId, storeId), eq(carrierAccounts.enabled, true)))
    .orderBy(carrierAccounts.sortOrder)
    .limit(1)

  const [zone] = await db
    .select()
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.country, country)))
    .limit(1)

  if (!zone || !zone.enabled) {
    return {
      price: 0,
      minDays: null as number | null,
      maxDays: null as number | null,
      zone: null,
      available: false,
      carrierName: null as string | null,
      carrierSlug: null as string | null,
      freeOver: 0,
    }
  }

  /*
    الأولوية: الأخصّ بيغلب الأعمّ.

    سعر الشركة الموحّد كان بيتحطّ **بعد** سعر المحافظة فبيلغيه —
    يعني التاجر اللي ربط شركة ما كانش يقدر يسعّر بالمحافظة أصلًا،
    والصعيد كان بياخد سعر القاهرة. وده عكس اللي شركات الشحن نفسها
    بتعمله: كلها بتسعّر بالمنطقة.

    السعر الموحّد مكانه الصح هو بديل السعر الافتراضي — «اللي الشركة
    بتاخده مني عمومًا» — والمحافظة اللي ليها سعر محدّد بتغلبه.
  */
  let price = carrier && carrier.flatRate > 0 ? carrier.flatRate : zone.defaultPrice
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

  /*
    حد الشحن المجاني: بتاع الشركة بيغلب بتاع المنطقة لما يكون
    مكتوبًا. التاجر اللي اتفق مع الشركة على «مجاني فوق ألف» لازم
    يشوف نفس الرقم في متجره — رقمين مختلفين معناهم إن حد هيدفع
    الفرق، وهو التاجر.
  */
  const freeOver =
    carrier && carrier.freeOver > 0
      ? carrier.freeOver
      : zone.freeShippingEnabled
        ? zone.freeOverAmount
        : 0

  return {
    price,
    minDays,
    maxDays,
    zone,
    available: true,
    /** اسم الشركة — بيظهر للعميل في الشيك أوت */
    carrierName: carrier?.name ?? null,
    carrierSlug: carrier?.carrier ?? null,
    freeOver,
  }
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

  const freeThreshold = ship.freeOver
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

/**
 * التسعيرة اللي الشيك أوت بيعرضها للعميل.
 *
 * **لازم تطلع من نفس المصدر اللي بيحاسب.** الشيك أوت بيحسب الشحن في
 * المتصفح عشان الرقم يتحرّك مع اختيار المحافظة من غير رحلة للخادم —
 * ولو الأرقام اللي بيحسب بيها جت من مكان تاني غير `shippingFor`،
 * العميل بيشوف ٥٠ ويتحاسب ٧٥، والفرق بيطلع من جيب التاجر في كل طلب.
 *
 * وبيتبع نفس أولوية `shippingFor` بالحرف: سعر المحافظة بيغلب سعر
 * الشركة الموحّد، والموحّد بيغلب الافتراضي. كان بيرمي أسعار المحافظات
 * كلها لما يبقى فيه سعر موحّد — فالتاجر اللي جاب تعريفة شركته
 * بالمحافظات كان بيلاقيها متسجّلة وما بتظهرش.
 */
export async function getDisplayShipping(storeId: string, country: string) {
  const [carrier] = await db
    .select({
      name: carrierAccounts.displayName,
      flatRate: carrierAccounts.flatRate,
      freeOver: carrierAccounts.freeOver,
    })
    .from(carrierAccounts)
    .where(and(eq(carrierAccounts.storeId, storeId), eq(carrierAccounts.enabled, true)))
    .orderBy(carrierAccounts.sortOrder)
    .limit(1)

  const [zone] = await db
    .select()
    .from(shippingZones)
    .where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.country, country)))
    .limit(1)

  const rates = zone
    ? await db
        .select({ city: shippingRates.city, price: shippingRates.price })
        .from(shippingRates)
        .where(and(eq(shippingRates.zoneId, zone.id), eq(shippingRates.enabled, true)))
    : []

  const carrierFlat = carrier && carrier.flatRate > 0 ? carrier.flatRate : 0

  const zoneFree = zone?.freeShippingEnabled ? zone.freeOverAmount : 0
  const freeOver = carrier && carrier.freeOver > 0 ? carrier.freeOver : zoneFree

  return {
    byCity: Object.fromEntries(rates.map((r) => [r.city, r.price])),
    defaultPrice: carrierFlat || zone?.defaultPrice || 0,
    freeOver: freeOver || null,
    carrierName: carrier?.name ?? null,
    codEnabled: zone?.codEnabled ?? true,
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

/**
 * طرق الدفع اللي العميل بيشوفها.
 *
 * ## ليه هنا لا في الصفحة
 * الشيك أوت الكامل والدفع السريع لازم يعرضوا **نفس القايمة**. لما
 * كانت مبنية جوّه صفحة الشيك أوت، أي شاشة تانية بتبيع كانت هتبنيها
 * تاني — وأول اختلاف بينهم بيبقى عميل شاف طريقة دفع في مكان ومالقاهاش
 * في مكان تاني في نفس المتجر.
 *
 * ## الترتيب
 * الدفع عند الاستلام الأول لو مشغّل — وهو مفتاحه في **إعدادات الشحن**
 * لا في طرق الدفع. لو قريناه من هنا كان التاجر يقفله ويلاقيه ظاهر.
 *
 * ## ومفيش قايمة فاضية
 * شيك أوت من غير أي طريقة دفع = زرار «أكّد الطلب» ما بيعملش حاجة،
 * والعميل بيسيب السلة وهو فاكر إن الموقع باظ.
 */
export async function listPaymentOptions(
  storeId: string,
  codEnabled: boolean,
): Promise<PaymentOption[]> {
  const saved = await getPaymentMethods(storeId)

  const options: PaymentOption[] = saved
    .filter((p) => p.gateway !== 'cod')
    .map((p) => {
      const def = paymentProvider(p.gateway)
      return {
        gateway: p.gateway,
        displayName: p.displayName ?? def?.name ?? p.gateway,
        instructions: p.instructions,
        brand: def?.brand ?? null,
        color: def?.color ?? null,
        online: Boolean(def),
      }
    })

  if (codEnabled) {
    const row = saved.find((p) => p.gateway === 'cod')
    options.unshift({
      gateway: 'cod',
      displayName: row?.displayName ?? 'الدفع عند الاستلام',
      instructions: row?.instructions ?? 'تدفع كاش للمندوب لما الطلب يوصلك.',
      brand: null,
      color: null,
      online: false,
    })
  }

  if (options.length === 0) {
    options.push({
      gateway: 'cod',
      displayName: 'الدفع عند الاستلام',
      instructions: null,
      brand: null,
      color: null,
      online: false,
    })
  }

  return options
}
