import 'server-only'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import {
  customers,
  inventoryMovements,
  orderEvents,
  orderItems,
  orders,
  productOptionValues,
  productOptions,
  productVariants,
  products,
  stores,
} from '@/db/schema'
import { computeTotals, type PricedLine } from './checkout'
import { normalizePhone } from './utils'
import type { ShippingAddress } from '@/db/schema'

/**
 * الطلب اليدوي — التاجر بيسجّل بإيده طلبًا جاله برّه المتجر.
 *
 * ## ليه ملف مستقل عن الشيك أوت
 * الشيك أوت بيحمي المتجر من العميل: الأسعار من القاعدة، المخزون
 * بيتفحص، والسطر اللي نافد بيترمي. الطلب اليدوي عكسه بالظبط — التاجر
 * صاحب المتجر، وهو اللي بيقرّر يبيع من غير مخزون أو بسعر اتفق عليه
 * في المحادثة.
 *
 * لو حطّينا الاتنين في دالة واحدة بأعلام، أول تعديل على قيود الشيك
 * أوت بيفتح ثغرة في التاني من غير ما حد ياخد باله. فالتسعير هنا
 * مكتوب بقواعده هو، والحساب النهائي بيمرّ على **نفس** `computeTotals`
 * عشان الشحن والضريبة والرسوم تطلع بنفس الأرقام في المسارين.
 *
 * ## القيود اللي فاضلة حتى للتاجر
 * - المنتج لازم يكون بتاع متجره هو (فحص `storeId` على كل قراءة).
 * - السعر المخصص مقفول لحد ما يفتحه، وبيتسجّل في سجل التدقيق.
 * - البيع بالسالب مقفول لحد ما يفتحه.
 * - الطلب بيتحسب في حصّة الباقة زي أي طلب — مش باب خلفي حواليها.
 */

export type ManualLineInput = {
  productId: string
  variantId?: string | null
  quantity: number
  /** سعر البند بالقرش — يتجاهَل لو التسعير المخصص مقفول */
  price?: number | null
}

export type ManualLineIssue = { name: string; reason: 'missing' | 'inactive' | 'stock' }

export type PricedManual = {
  lines: PricedLine[]
  issues: ManualLineIssue[]
  /** بنود اتباعت بسعر غير سعر الكتالوج — بتتسجّل في التدقيق */
  repriced: Array<{ name: string; from: number; to: number }>
}

/**
 * تسعير بنود الطلب اليدوي.
 *
 * بيرجّع نفس شكل `PricedLine` اللي `computeTotals` بيفهمه، عشان
 * الحساب النهائي يبقى واحدًا في المسارين.
 */
export async function priceManualLines(
  storeId: string,
  lines: ManualLineInput[],
  opts: { allowOversell: boolean; allowCustomPrice: boolean },
): Promise<PricedManual> {
  const out: PricedManual = { lines: [], issues: [], repriced: [] }

  const productIds = [...new Set(lines.map((l) => l.productId))].filter(Boolean)
  if (productIds.length === 0) return out

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
      type: products.type,
    })
    .from(products)
    .where(and(eq(products.storeId, storeId), inArray(products.id, productIds)))

  const byId = new Map(rows.map((r) => [r.id, r]))

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
        .where(and(eq(productVariants.storeId, storeId), inArray(productVariants.id, variantIds)))
    : []
  const variantById = new Map(variantRows.map((v) => [v.id, v]))

  /* «المقاس → XL» — الفاتورة وبوليصة الشحن محتاجين الاسم والقيمة كل واحد لوحده */
  const valueIds = [...new Set(variantRows.flatMap((v) => v.optionValueIds ?? []))].filter(Boolean)
  const labels = new Map<string, { name: string; value: string; position: number }>()
  if (valueIds.length) {
    const labelRows = await db
      .select({
        id: productOptionValues.id,
        value: productOptionValues.value,
        name: productOptions.name,
        position: productOptions.position,
      })
      .from(productOptionValues)
      .innerJoin(productOptions, eq(productOptions.id, productOptionValues.optionId))
      .where(inArray(productOptionValues.id, valueIds))
    for (const r of labelRows) labels.set(r.id, { name: r.name, value: r.value, position: r.position })
  }

  for (const line of lines) {
    const p = byId.get(line.productId)
    if (!p) {
      out.issues.push({ name: line.productId, reason: 'missing' })
      continue
    }

    const variant = line.variantId ? variantById.get(line.variantId) : undefined
    const useVariant = Boolean(variant && variant.productId === p.id)
    if (line.variantId && !useVariant) {
      out.issues.push({ name: p.name, reason: 'missing' })
      continue
    }

    /*
      المنتج الموقوف بيعدّي في الطلب اليدوي.

      التاجر بيوقف منتج عن الظهور في المتجر وهو لسه بيبيعه في المحل
      أو للجملة. رفضه هنا كان بيخلّيه يرجّعه للنشر عشان يسجّل طلبًا
      واحد — فيظهر لكل الزوار من غير ما يقصد.
    */
    const name = useVariant && variant ? `${p.name} — ${variant.title}` : p.name

    const catalogPrice = useVariant && variant ? variant.price : p.price
    let price = catalogPrice
    if (opts.allowCustomPrice && typeof line.price === 'number' && line.price >= 0) {
      price = Math.round(line.price)
      if (price !== catalogPrice) out.repriced.push({ name, from: catalogPrice, to: price })
    }

    const available =
      useVariant && variant ? variant.stock : p.trackInventory ? p.stock : null

    let quantity = Math.max(1, Math.round(line.quantity) || 1)
    if (available !== null && quantity > available) {
      if (!opts.allowOversell) {
        /*
          القصّ على المتاح لا الرفض.

          التاجر طلب ٥ ومعاه ٣: رفض السطر كله بيخلّيه يعيد كتابة
          الطلب من الأول. القصّ بيسجّل التلاتة وبيقول له إن الاتنين
          الباقيين مش موجودين — وهو يقرّر.
        */
        if (available <= 0) {
          out.issues.push({ name, reason: 'stock' })
          continue
        }
        out.issues.push({ name, reason: 'stock' })
        quantity = available
      }
    }

    const options =
      useVariant && variant
        ? (variant.optionValueIds ?? [])
            .map((id) => labels.get(id))
            .filter((o): o is NonNullable<typeof o> => Boolean(o))
            .sort((a, b) => a.position - b.position)
            .map((o) => ({ name: o.name, value: o.value }))
        : []

    out.lines.push({
      productId: p.id,
      type: p.type,
      variantId: useVariant && variant ? variant.id : null,
      name,
      productName: p.name,
      variantTitle: useVariant && variant ? variant.title : null,
      options,
      slug: p.slug,
      image: (useVariant && variant ? variant.image : null) ?? p.images[0] ?? null,
      price,
      costPrice: useVariant && variant ? (variant.costPrice ?? p.costPrice) : p.costPrice,
      quantity,
      total: price * quantity,
      available,
    })
  }

  return out
}

export type ManualOrderInput = {
  storeId: string
  /** الموظف اللي سجّل الطلب — بيتسجّل على الحدث وفي التدقيق */
  actorId: string
  customerId?: string | null
  name: string
  phone: string
  email?: string | null
  address: ShippingAddress
  lines: PricedLine[]
  /** توصيل ولا استلام من الفرع */
  fulfillment: 'delivery' | 'pickup'
  /** شحن يكتبه التاجر بإيده — `null` يعني احسبه من مناطق الشحن */
  shippingOverride?: number | null
  discount: number
  /** عربون محصَّل مقدّمًا */
  deposit: number
  paymentMethod: 'cod' | 'paid' | 'transfer'
  notes?: string | null
  internalNote?: string | null
  /** الحالة اللي التاجر عايز الطلب يبدأ بيها */
  status: 'pending' | 'confirmed'
}

export type ManualOrderResult = { orderId: string; orderNumber: number; customerId: string }

/**
 * إنشاء الطلب اليدوي — معاملة واحدة زي الشيك أوت بالظبط.
 *
 * كل حاجة جوّه `transaction` واحدة: الرقم والبنود وخصم المخزون
 * وحركة المخزون وعدّادات العميل والحدث. لو أي خطوة وقعت، مفيش رقم
 * طلب اتحرق ومفيش مخزون اتخصم على طلب مش موجود.
 */
export async function createManualOrder(input: ManualOrderInput): Promise<ManualOrderResult> {
  const phone = normalizePhone(input.phone)
  const email = input.email?.trim().toLowerCase() || null

  const totals = await computeTotals({
    storeId: input.storeId,
    lines: input.lines,
    country: input.address.country || 'EG',
    city: input.address.city ?? null,
    /*
      رسوم البوابة صفر هنا دايمًا.

      رسوم «الدفع عند الاستلام» بتتحسب على طلب المتجر لأن البوابة
      بتاخدها. الطلب اليدوي التاجر بيحصّله بنفسه، فإضافتها كانت
      بتزوّد على العميل مبلغًا محدّش هياخده.
    */
    paymentGateway: null,
    discount: input.discount,
    pickup: input.fulfillment === 'pickup',
  })

  const shipping =
    typeof input.shippingOverride === 'number'
      ? Math.max(0, Math.round(input.shippingOverride))
      : totals.shipping

  const total = Math.max(0, totals.subtotal - input.discount + shipping + totals.tax)
  const deposit = Math.min(Math.max(0, Math.round(input.deposit)), total)

  return db.transaction(async (tx) => {
    /* العميل: الموجود بيتربط، والجديد بيتعمل — والرقم هو المفتاح */
    let customerId = input.customerId ?? null

    if (customerId) {
      const [own] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.id, customerId), eq(customers.storeId, input.storeId)))
        .limit(1)
      if (!own) customerId = null
    }

    if (!customerId && phone) {
      const [existing] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(and(eq(customers.storeId, input.storeId), eq(customers.phone, phone)))
        .limit(1)
      customerId = existing?.id ?? null
    }

    if (!customerId) {
      const [created] = await tx
        .insert(customers)
        .values({
          storeId: input.storeId,
          name: input.name || null,
          phone: phone || null,
          /*
            البريد بيتساب فاضي لو كان متسجّلًا على عميل تاني.

            الفهرس `(store_id, email)` فريد، والتاجر بيكتب بريدًا
            من محادثة — لو ضرب تعارضًا، رفض الطلب كله عقوبة على
            حاجة مالهاش لازمة أصلًا في طلب يدوي.
          */
          email,
          tags: ['طلب يدوي'],
        })
        .onConflictDoNothing()
        .returning({ id: customers.id })

      if (created) {
        customerId = created.id
      } else {
        const [fallback] = await tx
          .insert(customers)
          .values({ storeId: input.storeId, name: input.name || null, phone: phone || null, tags: ['طلب يدوي'] })
          .returning({ id: customers.id })
        customerId = fallback.id
      }
    } else {
      await tx
        .update(customers)
        .set({ name: sql`coalesce(${customers.name}, ${input.name || null})` })
        .where(and(eq(customers.id, customerId), eq(customers.storeId, input.storeId)))
    }

    const [seq] = await tx
      .update(stores)
      .set({ orderSequence: sql`${stores.orderSequence} + 1` })
      .where(eq(stores.id, input.storeId))
      .returning({ orderSequence: stores.orderSequence, currency: stores.currency })

    const orderNumber = seq.orderSequence

    const [created] = await tx
      .insert(orders)
      .values({
        storeId: input.storeId,
        orderNumber,
        customerId,
        customerName: input.name || null,
        customerPhone: phone || null,
        customerEmail: email,
        shippingAddress: { ...input.address, name: input.name, phone },
        subtotal: totals.subtotal,
        shippingTotal: shipping,
        taxTotal: totals.tax,
        discountTotal: input.discount,
        codFee: 0,
        total,
        costTotal: totals.costTotal,
        depositPaid: deposit,
        currency: seq.currency,
        paymentMethod: input.paymentMethod === 'cod' ? 'cod' : 'manual_transfer',
        paymentStatus: input.paymentMethod === 'paid' ? 'paid' : 'unpaid',
        paidAt: input.paymentMethod === 'paid' ? new Date() : null,
        status: input.status,
        confirmedAt: input.status === 'confirmed' ? new Date() : null,
        shippingMethod: input.fulfillment,
        notes: input.notes?.trim() || null,
        internalNote: input.internalNote?.trim() || null,
        isIncomplete: false,
        source: 'manual',
        /*
          الطلب اليدوي متأكَّد بطبيعته: التاجر كلّم العميل بنفسه
          قبل ما يسجّله. لو سبناه غير متحقّق، مهمّة التأكيد التلقائي
          هتبعتله رسالة تسأله «إنت طالب فعلًا؟» بعد ما التاجر خلص
          كلام معاه — ودي بتخلّي العميل يشك في الطلب ويلغيه.
        */
        otpVerifiedAt: new Date(),
      })
      .returning({ id: orders.id })

    const orderId = created.id

    await tx.insert(orderItems).values(
      input.lines.map((l) => ({
        orderId,
        storeId: input.storeId,
        productId: l.productId,
        variantId: l.variantId ?? null,
        name: l.name,
        variantTitle: l.variantTitle,
        options: l.options,
        image: l.image,
        price: l.price,
        costPrice: l.costPrice,
        quantity: l.quantity,
        total: l.total,
      })),
    )

    /* خصم المخزون — نفس قواعد الشيك أوت: المتغيّر بياخد من رصيده هو */
    for (const l of input.lines) {
      if (l.available === null) continue

      if (l.variantId) {
        await tx
          .update(productVariants)
          .set({ stock: sql`greatest(0, ${productVariants.stock} - ${l.quantity})` })
          .where(and(eq(productVariants.id, l.variantId), eq(productVariants.storeId, input.storeId)))
      } else {
        await tx
          .update(products)
          .set({ stock: sql`greatest(0, ${products.stock} - ${l.quantity})` })
          .where(and(eq(products.id, l.productId), eq(products.storeId, input.storeId)))
      }

      await tx
        .update(products)
        .set({ soldCount: sql`${products.soldCount} + ${l.quantity}` })
        .where(and(eq(products.id, l.productId), eq(products.storeId, input.storeId)))

      await tx.insert(inventoryMovements).values({
        storeId: input.storeId,
        productId: l.productId,
        variantId: l.variantId ?? null,
        delta: -l.quantity,
        reason: 'order',
        referenceId: orderId,
        note: `طلب يدوي رقم ${orderNumber}`,
      })
    }

    await tx
      .update(customers)
      .set({
        ordersCount: sql`${customers.ordersCount} + 1`,
        totalSpent: sql`${customers.totalSpent} + ${total}`,
        lastOrderAt: new Date(),
      })
      .where(eq(customers.id, customerId))

    await tx.insert(orderEvents).values({
      orderId,
      storeId: input.storeId,
      type: 'created',
      message: 'طلب اتسجّل يدويًا من اللوحة',
      actorType: 'merchant',
      actorId: input.actorId,
      meta: deposit > 0 ? { deposit } : undefined,
    })

    return { orderId, orderNumber, customerId }
  })
}
