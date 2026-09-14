import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import { orders, paymentAttempts, paymentMethods, shippingZones } from '@/db/schema'
import { readPaymentProviders } from '@/lib/provider-store'
import { PAYMENT_PROVIDERS } from '@/lib/providers'

/**
 * بيانات صفحة الدفع — صفحة اللوحة ومسار التطبيق (`/api/app/payments`) بيقروا من هنا.
 */
export async function loadPayments(storeId: string, country: string) {
  const [methods, providers, [zone]] = await Promise.all([
    db
      .select({
        gateway: paymentMethods.gateway,
        enabled: paymentMethods.enabled,
        displayName: paymentMethods.displayName,
        instructions: paymentMethods.instructions,
        fixedFee: paymentMethods.fixedFee,
      })
      .from(paymentMethods)
      .where(eq(paymentMethods.storeId, storeId)),
    /*
      حالة البوابات بتتقرا لوحدها عشان المفاتيح تفضل على الخادم.
      اللي بيرجع: مفعّلة ولا لأ، وأسماء المفاتيح المحفوظة — من غير أي قيمة.
    */
    readPaymentProviders(storeId, PAYMENT_PROVIDERS),
    /*
      حالة الدفع عند الاستلام بتتقرا من منطقة الشحن لا من طرق الدفع:
      مفتاحه هناك، وعرضه هنا بقيمة تانية كان هيخلّي التاجر يفتكر إنه
      قافله وهو مفتوح.
    */
    db
      .select({ codEnabled: shippingZones.codEnabled })
      .from(shippingZones)
      .where(and(eq(shippingZones.storeId, storeId), eq(shippingZones.country, country)))
      .limit(1),
  ])

  return { methods, providers, codEnabled: zone?.codEnabled ?? true }
}

/** آخر ٤٠ محاولة دفع على المتجر — «أنا دفعت» والطلب ظاهر مش مدفوع */
export async function loadPaymentAttempts(storeId: string) {
  return db
    .select({
      id: paymentAttempts.id,
      gateway: paymentAttempts.gateway,
      status: paymentAttempts.status,
      amount: paymentAttempts.amount,
      currency: paymentAttempts.currency,
      reference: paymentAttempts.reference,
      errorMessage: paymentAttempts.errorMessage,
      createdAt: paymentAttempts.createdAt,
      orderId: paymentAttempts.orderId,
      orderNumber: orders.orderNumber,
    })
    .from(paymentAttempts)
    .leftJoin(orders, eq(orders.id, paymentAttempts.orderId))
    .where(eq(paymentAttempts.storeId, storeId))
    .orderBy(desc(paymentAttempts.createdAt))
    .limit(40)
}
