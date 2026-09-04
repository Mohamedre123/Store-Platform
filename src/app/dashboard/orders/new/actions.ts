'use server'

import { revalidatePath } from 'next/cache'
import { and, desc, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { categories, customers, productVariants, products } from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { getOrderQuota } from '@/lib/entitlements'
import { recordAudit } from '@/lib/audit'
import { createManualOrder, priceManualLines, type ManualLineInput } from '@/lib/manual-order'
import { computeTotals } from '@/lib/checkout'
import { formatMoney, normalizePhone } from '@/lib/utils'

/**
 * أفعال الطلب اليدوي.
 *
 * كل قراءة هنا مقيّدة بمتجر صاحب الجلسة. المعرّفات الجاية من المتصفح
 * مالهاش أي ثقة: التاجر يقدر يعدّل الطلب في أدوات المطوّرين ويحطّ
 * معرّف منتج تاجر تاني — والفلترة بـ`store.id` هي اللي بتمنعه.
 */

/* ────────────────────────── بحث المنتجات ────────────────────────── */

export type OrderProductVariant = {
  id: string
  title: string
  price: number
  stock: number
  isActive: boolean
}

export type OrderProduct = {
  id: string
  name: string
  sku: string | null
  image: string | null
  price: number
  stock: number
  trackInventory: boolean
  status: string
  categoryName: string | null
  variants: OrderProductVariant[]
}

/**
 * منتجات للطلب اليدوي.
 *
 * بترجّع **المخفي والنافد كمان** ومعاه حالته. التاجر بيسجّل طلبًا
 * لحاجة اتفق عليها في محادثة، وممكن تكون موقوفة عن الظهور أو
 * بيجيبها من مورّده — وإخفاؤها هنا بيخلّيه يفتكر إنها اتمسحت.
 */
export async function searchOrderProducts(input: {
  query?: string
  categoryId?: string | null
}): Promise<OrderProduct[]> {
  const { store } = await getDashboardContext()

  const conditions = [eq(products.storeId, store.id), isNull(products.deletedAt)]

  const q = input.query?.trim()
  if (q) {
    const like = `%${q}%`
    conditions.push(or(ilike(products.name, like), ilike(products.sku, like))!)
  }
  if (input.categoryId) conditions.push(eq(products.categoryId, input.categoryId))

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      sku: products.sku,
      images: products.images,
      price: products.price,
      stock: products.stock,
      trackInventory: products.trackInventory,
      status: products.status,
      categoryName: categories.name,
    })
    .from(products)
    .leftJoin(categories, eq(categories.id, products.categoryId))
    .where(and(...conditions))
    .orderBy(desc(products.soldCount), desc(products.createdAt))
    .limit(30)

  if (rows.length === 0) return []

  /*
    المتغيّرات في استعلام واحد لكل النتايج.

    استعلام لكل منتج معناه ٣٠ رحلة على كل حرف بيتكتب في البحث —
    وده بيخنق تجميعة الاتصالات على أول تاجر بيكتب بسرعة.
  */
  const variantRows = await db
    .select({
      id: productVariants.id,
      productId: productVariants.productId,
      title: productVariants.title,
      price: productVariants.price,
      stock: productVariants.stock,
      isActive: productVariants.isActive,
    })
    .from(productVariants)
    .where(
      and(
        eq(productVariants.storeId, store.id),
        inArray(
          productVariants.productId,
          rows.map((r) => r.id),
        ),
      ),
    )

  const byProduct = new Map<string, OrderProductVariant[]>()
  for (const v of variantRows) {
    const list = byProduct.get(v.productId) ?? []
    list.push({ id: v.id, title: v.title, price: v.price, stock: v.stock, isActive: v.isActive })
    byProduct.set(v.productId, list)
  }

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    sku: r.sku,
    image: r.images?.[0] ?? null,
    price: r.price,
    stock: r.stock,
    trackInventory: r.trackInventory,
    status: r.status,
    categoryName: r.categoryName,
    variants: byProduct.get(r.id) ?? [],
  }))
}

/* ────────────────────────── بحث العملاء ────────────────────────── */

export type OrderCustomer = {
  id: string
  name: string | null
  phone: string | null
  email: string | null
  ordersCount: number
  city: string | null
  street: string | null
  area: string | null
}

/**
 * عملاء المتجر للبحث السريع.
 *
 * التاجر بيكتب أول أرقام الموبايل وبيلاقي العميل بعنوانه — فما
 * يضطرش يسأله على العنوان تاني كل مرة، ولا يسجّله كعميل جديد
 * فيتقسّم تاريخه على حسابين.
 */
export async function searchOrderCustomers(query: string): Promise<OrderCustomer[]> {
  const { store } = await getDashboardContext()

  const q = query.trim()
  if (q.length < 2) return []

  const like = `%${q}%`
  const rows = await db
    .select({
      id: customers.id,
      name: customers.name,
      phone: customers.phone,
      email: customers.email,
      ordersCount: customers.ordersCount,
    })
    .from(customers)
    .where(
      and(
        eq(customers.storeId, store.id),
        eq(customers.isBlocked, false),
        or(ilike(customers.name, like), ilike(customers.phone, like), ilike(customers.email, like))!,
      ),
    )
    .orderBy(desc(customers.lastOrderAt))
    .limit(8)

  if (rows.length === 0) return []

  /**
   * آخر عنوان استعمله العميل — من آخر طلب لا من دفتر عناوينه.
   *
   * أغلب العملاء عندهم عنوان واحد وما بيفتحوش دفتر العناوين أصلًا،
   * فالطلب الأخير هو المصدر اللي فيه بيانات فعلًا.
   */
  const addressRows = await db.execute<{
    customer_id: string
    city: string | null
    area: string | null
    street: string | null
  }>(sql`
    select distinct on (o.customer_id)
      o.customer_id,
      o.shipping_address->>'city'   as city,
      o.shipping_address->>'area'   as area,
      o.shipping_address->>'street' as street
    from orders o
    where o.store_id = ${store.id}
      and o.customer_id in (${sql.join(
        rows.map((r) => sql`${r.id}::uuid`),
        sql`, `,
      )})
      and o.shipping_address is not null
    order by o.customer_id, o.created_at desc
  `)

  const addressBy = new Map(
    [...addressRows].map((r) => [r.customer_id, { city: r.city, area: r.area, street: r.street }]),
  )

  return rows.map((r) => ({
    ...r,
    city: addressBy.get(r.id)?.city ?? null,
    area: addressBy.get(r.id)?.area ?? null,
    street: addressBy.get(r.id)?.street ?? null,
  }))
}

/* ────────────────────────── التسعير الحيّ ────────────────────────── */

const lineSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().nullish(),
  quantity: z.coerce.number().int().min(1).max(9999),
  price: z.coerce.number().int().min(0).nullish(),
})

export type ManualQuote = {
  subtotal: number
  shipping: number
  tax: number
  discount: number
  total: number
  /** بنود اتقصّت أو اترفضت — التاجر لازم يشوفها قبل ما يحفظ */
  issues: Array<{ name: string; reason: 'missing' | 'inactive' | 'stock' }>
}

/**
 * حساب الطلب قبل الحفظ — **على الخادم لا في المتصفح**.
 *
 * الشحن والضريبة وحدود الشحن المجاني كلها قواعد بتتغيّر من إعدادات
 * التاجر. لو المتصفح حسبها بنسخته، التاجر بيشوف رقمًا والطلب
 * بيتحفظ برقم تاني — وهو بيقول للعميل الرقم اللي شافه.
 */
export async function quoteManualOrder(raw: unknown): Promise<ManualQuote | { error: string }> {
  const schema = z.object({
    lines: z.array(lineSchema).max(100),
    country: z.string().trim().max(2).default('EG'),
    city: z.string().trim().max(80).nullish(),
    discount: z.coerce.number().int().min(0).default(0),
    shippingOverride: z.coerce.number().int().min(0).nullish(),
    fulfillment: z.enum(['delivery', 'pickup']).default('delivery'),
  })

  const parsed = schema.safeParse(raw)
  if (!parsed.success) return { error: 'بيانات ناقصة' }
  const input = parsed.data

  const { store } = await getDashboardContext()

  if (input.lines.length === 0) {
    return { subtotal: 0, shipping: 0, tax: 0, discount: 0, total: 0, issues: [] }
  }

  const priced = await priceManualLines(store.id, input.lines as ManualLineInput[], {
    allowOversell: store.manualOversell,
    allowCustomPrice: store.manualCustomPricing,
  })

  const totals = await computeTotals({
    storeId: store.id,
    lines: priced.lines,
    country: input.country || 'EG',
    city: input.city ?? null,
    paymentGateway: null,
    discount: input.discount,
    pickup: input.fulfillment === 'pickup',
  })

  const shipping =
    typeof input.shippingOverride === 'number'
      ? Math.max(0, input.shippingOverride)
      : totals.shipping

  return {
    subtotal: totals.subtotal,
    shipping,
    tax: totals.tax,
    discount: input.discount,
    total: Math.max(0, totals.subtotal - input.discount + shipping + totals.tax),
    issues: priced.issues,
  }
}

/* ────────────────────────── الإنشاء ────────────────────────── */

export type ManualOrderState =
  | { ok: true; orderId: string; orderNumber: number }
  | { error: string }
  | null

const createSchema = z.object({
  customerId: z.string().uuid().nullish(),
  name: z.string().trim().min(2, 'اكتب اسم العميل').max(80),
  phone: z.string().trim().min(6, 'اكتب رقم موبايل صحيح').max(30),
  email: z.string().trim().max(120).nullish(),
  country: z.string().trim().max(2).default('EG'),
  city: z.string().trim().max(80).nullish(),
  area: z.string().trim().max(120).nullish(),
  street: z.string().trim().max(240).nullish(),
  building: z.string().trim().max(80).nullish(),
  fulfillment: z.enum(['delivery', 'pickup']).default('delivery'),
  lines: z.array(lineSchema).min(1, 'ضيف منتج واحد على الأقل').max(100),
  discount: z.coerce.number().int().min(0).default(0),
  shippingOverride: z.coerce.number().int().min(0).nullish(),
  deposit: z.coerce.number().int().min(0).default(0),
  paymentMethod: z.enum(['cod', 'paid', 'transfer']).default('cod'),
  status: z.enum(['pending', 'confirmed']).default('confirmed'),
  notes: z.string().trim().max(1000).nullish(),
  internalNote: z.string().trim().max(1000).nullish(),
})

export async function createManualOrderAction(raw: unknown): Promise<ManualOrderState> {
  const parsed = createSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  const input = parsed.data

  const { store, user } = await getDashboardContext()

  if (!store.manualOrdersEnabled) {
    return { error: 'الطلبات اليدوية مقفولة — افتحها من إعدادات الطلب اليدوي.' }
  }

  /**
   * الحصّة بتتفحص هنا كمان.
   *
   * الطلب اليدوي طلب: لو عدّى من غير فحص، أي متجر على الباقة المجانية
   * بيفضل يسجّل من اللوحة للأبد والحد اللي على الشيك أوت بيبقى شكلي.
   */
  const quota = await getOrderQuota(store)
  if (quota.blocked) {
    return {
      error: `وصلت لحد الباقة المجانية (${quota.limit} طلبات). اشترك من صفحة الاشتراك عشان تكمّل.`,
    }
  }

  const priced = await priceManualLines(store.id, input.lines as ManualLineInput[], {
    allowOversell: store.manualOversell,
    allowCustomPrice: store.manualCustomPricing,
  })

  if (priced.lines.length === 0) {
    return { error: 'مفيش بند صالح في الطلب — راجع المنتجات المختارة.' }
  }

  /*
    الخصم ما ينفعش يعدّي المجموع.

    خصم أكبر من المجموع بيطلّع إجمالي بالسالب، والتقارير بعدها بتحسب
    إيراد ناقص من غير سبب ظاهر.
  */
  const subtotal = priced.lines.reduce((n, l) => n + l.total, 0)
  const discount = Math.min(input.discount, subtotal)

  const result = await createManualOrder({
    storeId: store.id,
    actorId: user.id,
    customerId: input.customerId ?? null,
    name: input.name,
    phone: input.phone,
    email: input.email ?? null,
    address: {
      country: input.country || 'EG',
      city: input.city ?? undefined,
      area: input.area ?? undefined,
      street: input.street ?? undefined,
      building: input.building ?? undefined,
      notes: input.notes ?? undefined,
    },
    lines: priced.lines,
    fulfillment: input.fulfillment,
    shippingOverride: input.shippingOverride ?? null,
    discount,
    deposit: input.deposit,
    paymentMethod: input.paymentMethod,
    notes: input.notes ?? null,
    internalNote: input.internalNote ?? null,
    status: input.status,
  })

  /**
   * السعر المخصص بيتسجّل في التدقيق.
   *
   * ده المفتاح الوحيد في الشاشة اللي بيخلّي موظف يبيع بأي سعر من
   * غير ما يبان في أي تقرير. السطر هنا هو اللي بيخلّي التاجر يقدر
   * يسأل «مين باع بالسعر ده».
   */
  if (priced.repriced.length) {
    await recordAudit({
      storeId: store.id,
      userId: user.id,
      action: 'product.price_change',
      resource: 'order',
      resourceId: result.orderId,
      before: Object.fromEntries(
        priced.repriced.map((r) => [r.name, formatMoney(r.from, store.currency)]),
      ),
      after: Object.fromEntries(
        priced.repriced.map((r) => [r.name, formatMoney(r.to, store.currency)]),
      ),
    })
  }

  revalidatePath('/dashboard/orders')
  revalidatePath('/dashboard')
  return { ok: true, orderId: result.orderId, orderNumber: result.orderNumber }
}

/** رقم بصيغة موحّدة للعرض في الشاشة قبل الحفظ */
export async function normalizeOrderPhone(input: string): Promise<string> {
  return normalizePhone(input)
}
