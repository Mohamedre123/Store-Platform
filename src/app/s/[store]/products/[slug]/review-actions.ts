'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import { customers, orderItems, orders, products, reviews } from '@/db/schema'
import { getStore } from '@/lib/storefront'
import { normalizePhone } from '@/lib/utils'

const schema = z.object({
  storeIdentifier: z.string().min(1),
  productId: z.string().uuid(),
  authorName: z.string().trim().min(2, 'اكتب اسمك').max(60),
  phone: z.string().trim().optional(),
  rating: z.number().int().min(1).max(5),
  body: z.string().trim().max(1000).optional(),
})

export type ReviewState = { ok?: boolean; error?: string; pending?: boolean } | null

/**
 * إضافة مراجعة على منتج.
 *
 * المراجعة بتتحفظ **غير معتمدة** وتظهر بعد ما التاجر يوافق. من غير
 * المراجعة دي أي حد يقدر يكتب أي كلام على منتجات التاجر ويظهر فورًا
 * للعملاء — سبام أو تشويه متعمّد.
 *
 * لو الرقم عليه طلب فيه المنتج ده، بنعلّم المراجعة كـ«شراء موثّق» —
 * ودي أكتر حاجة بتدّي العميل التاني ثقة.
 */
export async function submitReviewAction(raw: unknown): Promise<ReviewState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'فيه بيانات ناقصة' }
  }
  const input = parsed.data

  const store = await getStore(input.storeIdentifier)
  if (!store) return { error: 'المتجر مش موجود' }

  // المنتج لازم يكون بتاع المتجر ده — مش أي معرّف يتبعت
  const [product] = await db
    .select({ id: products.id, slug: products.slug })
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.storeId, store.id)))
    .limit(1)

  if (!product) return { error: 'المنتج مش موجود' }

  let customerId: string | null = null
  let verified = false

  if (input.phone) {
    const phone = normalizePhone(input.phone, store.country === 'EG' ? '20' : '966')
    const [customer] = await db
      .select({ id: customers.id })
      .from(customers)
      .where(and(eq(customers.storeId, store.id), eq(customers.phone, phone)))
      .limit(1)

    if (customer) {
      customerId = customer.id
      const [bought] = await db
        .select({ n: sql<number>`count(*)::int` })
        .from(orderItems)
        .innerJoin(orders, eq(orders.id, orderItems.orderId))
        .where(
          and(
            eq(orderItems.productId, input.productId),
            eq(orders.customerId, customer.id),
            eq(orders.isIncomplete, false),
          ),
        )
      verified = (bought?.n ?? 0) > 0
    }
  }

  await db.insert(reviews).values({
    storeId: store.id,
    productId: input.productId,
    customerId,
    authorName: input.authorName,
    rating: input.rating,
    body: input.body || null,
    isVerifiedPurchase: verified,
    isApproved: false,
  })

  revalidatePath(`/s/${store.slug}/products/${product.slug}`)
  return { ok: true, pending: true }
}
