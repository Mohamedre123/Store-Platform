'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/db'
import {
  customers,
  inventoryMovements,
  orderEvents,
  orderItems,
  orders,
  products,
  productVariants,
} from '@/db/schema'
import { getDashboardContext } from '@/lib/store-context'
import { computeTotals, getPaymentMethods, priceCart } from '@/lib/checkout'
import { startPayment } from '@/lib/payment-dispatch'
import { normalizePhone } from '@/lib/utils'
import { publicStoreUrl } from '@/lib/domain'
import { paymentProvider } from '@/lib/providers'

/**
 * تحويل السلة المتروكة لطلب — التاجر بيكمّلها بنفسه.
 *
 * ## المشكلة اللي بيحلّها
 * نص السلات المتروكة بتترد على الواتساب: «تمام ابعتهولي». وبعدها
 * التاجر كان بيقعد يعمل الطلب بإيده من الأول — يدوّر على المنتج،
 * يحطّ السعر، يكتب العنوان — أو ما بيعملهوش خالص ويسيب البيعة.
 *
 * السلة فيها كل حاجة أصلًا: البنود، السعر، الرقم، وأحيانًا العنوان.
 * اللي ناقص سطر أو اتنين، والتاجر بيكمّلهم في ثانية.
 *
 * ## الدفع عند الاستلام هو الافتراضي — وده مقصود
 * **ما ينفعش نسجّل طلبًا «مدفوعًا» والعميل ما دفعش.** التاجر بيتكلم
 * مع العميل على الواتساب، والعميل وافق على الطلب لا على الدفع.
 * فالطلب بيتسجّل بالدفع عند الاستلام، ولو التاجر مربوط ببوابة بيقدر
 * يبعتله رابط دفع يدفع منه قبل الشحن.
 *
 * ## الأسعار بتتحسب من جديد
 * السلة ممكن يكون عليها يومين والتاجر غيّر أسعاره. `priceCart` بيقرا
 * السعر الحالي من قاعدة البيانات — والتاجر بيشوف الإجمالي الجديد
 * قبل ما يأكّد.
 */

const schema = z.object({
  orderId: z.string().uuid(),
  name: z.string().trim().max(120).optional(),
  phone: z.string().trim().min(6, 'اكتب رقم تليفون صحيح'),
  email: z.string().trim().email().optional().or(z.literal('')),
  city: z.string().trim().optional(),
  area: z.string().trim().optional(),
  street: z.string().trim().optional(),
  notes: z.string().trim().max(500).optional(),
})

export type ConvertState =
  | { ok: true; orderNumber: number; total: number; payUrl?: string | null }
  | { ok: false; error: string }

export async function convertCartToOrderAction(raw: unknown): Promise<ConvertState> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? 'بيانات ناقصة' }
  }

  const input = parsed.data
  const { store, user } = await getDashboardContext()

  const [order] = await db
    .select({
      id: orders.id,
      orderNumber: orders.orderNumber,
      recoveryToken: orders.recoveryToken,
      customerId: orders.customerId,
      address: orders.shippingAddress,
    })
    .from(orders)
    .where(
      and(
        eq(orders.id, input.orderId),
        eq(orders.storeId, store.id),
        eq(orders.isIncomplete, true),
      ),
    )
    .limit(1)

  if (!order) return { ok: false, error: 'السلة مش موجودة أو اتحوّلت خلاص' }

  const savedItems = await db
    .select({
      productId: orderItems.productId,
      variantId: orderItems.variantId,
      quantity: orderItems.quantity,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, order.id))

  const lines = savedItems
    .filter((i) => i.productId)
    .map((i) => ({
      productId: i.productId!,
      variantId: i.variantId ?? undefined,
      quantity: i.quantity,
    }))

  if (lines.length === 0) return { ok: false, error: 'السلة فاضية' }

  /*
    نفس فحص الخيارات اللي على العميل بالظبط.

    التاجر ما ينفعش يعدّي طلبًا بلا مقاس عشان هو اللي بيعمله — هو
    اللي هيغلّف الطلب وهيكتشف إنه مش عارف يبعت إيه. ولو عدّى، الطلب
    بيوصل لشركة الشحن بلا تفصيلة ويترجع.
  */
  const { lines: priced, issue } = await priceCart(store.id, lines)
  if (issue) {
    const messages = {
      empty: 'السلة فاضية',
      unavailable: 'فيه منتجات ما بقتش متاحة — شيلها من السلة الأول',
      out_of_stock: 'فيه منتجات نفدت كميتها',
      below_minimum: 'الطلب أقل من الحد الأدنى',
      needs_options: 'العميل ما اختارش المقاس أو اللون — اسأله عنه الأول عشان تعرف تبعت إيه',
    } as const
    return { ok: false, error: messages[issue.kind] }
  }

  const phone = normalizePhone(input.phone, store.country === 'EG' ? '20' : '966')
  const city = input.city?.trim() || order.address?.city || null

  const totals = await computeTotals({
    storeId: store.id,
    lines: priced,
    country: store.country,
    city,
    paymentGateway: 'cod',
  })

  await db.transaction(async (tx) => {
    /*
      نفس السجل بيتحوّل، ما بيتعملش طلب جديد: الرقم اللي التاجر شافه
      في السلة المتروكة هو نفسه رقم الطلب، والمسار الزمني بيفضل من
      أول لحظة العميل فتح الشيك أوت.
    */
    await tx
      .update(orders)
      .set({
        status: 'confirmed',
        isIncomplete: false,
        customerName: input.name?.trim() || null,
        customerPhone: phone,
        customerEmail: input.email?.trim() || null,
        shippingAddress: {
          name: input.name?.trim(),
          phone,
          country: store.country,
          city: city ?? undefined,
          area: input.area?.trim(),
          street: input.street?.trim(),
          notes: input.notes?.trim(),
        },
        subtotal: totals.subtotal,
        shippingTotal: totals.shipping,
        codFee: totals.codFee,
        taxTotal: totals.tax,
        discountTotal: totals.discount,
        total: totals.total,
        costTotal: totals.costTotal,
        paymentMethod: 'cod',
        paymentGateway: 'cod',
        paymentStatus: 'unpaid',
        /* مصدره «يدوي» مش «المتجر» — التقارير لازم تفرّق */
        source: 'manual',
        notes: input.notes?.trim() || null,
        shippingMethod: 'delivery',
        recoveredAt: new Date(),
        confirmedAt: new Date(),
      })
      .where(eq(orders.id, order.id))

    await tx.delete(orderItems).where(eq(orderItems.orderId, order.id))
    await tx.insert(orderItems).values(
      priced.map((l) => ({
        orderId: order.id,
        storeId: store.id,
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

    /*
      خصم المخزون — زي الطلب العادي بالظبط.

      من غيره التاجر بيبيع نفس القطعة مرتين: مرة من السلة المحوّلة
      ومرة من المتجر، والكمية على الورق أكتر من اللي في المخزن.
    */
    for (const l of priced) {
      if (l.available === null) continue

      if (l.variantId) {
        await tx
          .update(productVariants)
          .set({ stock: sql`greatest(0, ${productVariants.stock} - ${l.quantity})` })
          .where(and(eq(productVariants.id, l.variantId), eq(productVariants.storeId, store.id)))
      } else {
        await tx
          .update(products)
          .set({ stock: sql`greatest(0, ${products.stock} - ${l.quantity})` })
          .where(and(eq(products.id, l.productId), eq(products.storeId, store.id)))
      }

      await tx
        .update(products)
        .set({ soldCount: sql`${products.soldCount} + ${l.quantity}` })
        .where(and(eq(products.id, l.productId), eq(products.storeId, store.id)))

      await tx.insert(inventoryMovements).values({
        storeId: store.id,
        productId: l.productId,
        variantId: l.variantId ?? null,
        delta: -l.quantity,
        reason: 'order',
        referenceId: order.id,
        note: `سلة متروكة اتحوّلت لطلب ${order.orderNumber}`,
      })
    }

    if (order.customerId) {
      await tx
        .update(customers)
        .set({
          ordersCount: sql`${customers.ordersCount} + 1`,
          totalSpent: sql`${customers.totalSpent} + ${totals.total}`,
          lastOrderAt: new Date(),
        })
        .where(eq(customers.id, order.customerId))
    }

    await tx.insert(orderEvents).values({
      orderId: order.id,
      storeId: store.id,
      type: 'created',
      message: 'التاجر حوّل السلة المتروكة لطلب مؤكّد بالدفع عند الاستلام',
      actorType: 'merchant',
      actorId: user.id,
    })
  })

  revalidatePath('/dashboard/orders')
  revalidatePath(`/dashboard/orders/${order.id}`)

  return { ok: true, orderNumber: order.orderNumber, total: totals.total }
}

/**
 * رابط دفع للطلب — للعميل اللي عايز يدفع بالفيزا.
 *
 * التاجر حوّل السلة لطلب بالدفع عند الاستلام (ده الافتراضي الآمن)،
 * والعميل قال «أنا أدفع أونلاين». الرابط ده بيبعتهوله وبيدفع منه
 * قبل الشحن.
 *
 * **بيرجع خطأ واضح لو مفيش بوابة مربوطة** بدل ما يرجّع رابط ميت:
 * التاجر لازم يعرف إن الميزة دي محتاجة ربط بوابة، لا يفتكر إن فيه
 * عطل.
 */
export async function paymentLinkAction(input: {
  orderId: string
  gateway?: string
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const { store } = await getDashboardContext()

  const [order] = await db
    .select({ id: orders.id, orderNumber: orders.orderNumber, token: orders.recoveryToken })
    .from(orders)
    .where(and(eq(orders.id, input.orderId), eq(orders.storeId, store.id)))
    .limit(1)

  if (!order) return { ok: false, error: 'الطلب مش موجود' }

  /* أول بوابة أونلاين مربوطة — الدفع عند الاستلام مش بوابة */
  const methods = await getPaymentMethods(store.id)
  const online = methods.find((m) => paymentProvider(m.gateway))

  if (!online) {
    return {
      ok: false,
      error: 'مفيش بوابة دفع مربوطة. اربط واحدة من صفحة المدفوعات عشان تقدر تبعت رابط دفع.',
    }
  }

  await db
    .update(orders)
    .set({ paymentGateway: online.gateway, paymentMethod: 'online' })
    .where(eq(orders.id, order.id))

  const session = await startPayment(store.id, order.id)
  if (session.ok) return { ok: true, url: session.redirectUrl }

  /*
    البوابة رفضت تفتح جلسة — بنرجّع صفحة الطلب ومعاها زرار «ادفع
    دلوقتي». العميل بيقدر يحاول من هناك، والتاجر ما بيقفش.
  */
  const fallback = `${publicStoreUrl(store)}/order/${order.orderNumber}?t=${encodeURIComponent(order.token ?? '')}&pay_error=1`
  return { ok: true, url: fallback }
}
