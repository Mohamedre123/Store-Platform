import 'server-only'
import { storeSenderAddress } from '@/lib/store-email-domain'
import { and, eq, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { customers, orderItems, orders, stores } from '@/db/schema'
import type { CheckoutStage } from '@/db/schema'
import { getStoreTheme } from './storefront'
import { isEmailConfigured, sendEmail } from './email'
import { abandonedCartEmail } from './store-emails'
import { appUrl, publicStoreUrl } from './domain'
import { generateToken, hashToken } from './crypto'
import { runAutomations } from './automation'

/**
 * تذكير السلات المتروكة.
 *
 * الطلب الناقص بيتحفظ لحظة ما العميل يكتب رقمه (وأحيانًا بريده). لو
 * عدّت ساعة ومكمّلش، بنبعتله تذكيرة واحدة.
 *
 * قواعد مقصودة:
 * - تذكيرة واحدة بس لكل سلة. التذكير المتكرر بيتقرا سبام ويحرق العلاقة.
 * - بعد ساعة لا فورًا: العميل ممكن يكون لسه بيقارن أو بيسأل حد.
 * - وقبل ٧ أيام: أقدم من كده السلة بقت قديمة والرسالة بتبقى محرجة.
 * - الطلبات اللي اكتملت بتخرج تلقائيًا لأن isIncomplete بتبقى false.
 *
 * الجدولة يومية لا كل ساعة: خطة Vercel المجانية بتسمح بمهمة واحدة في
 * اليوم، والجدول الأكتر من كده بيخلّي النشر يفشل من أصله. نافذة الساعة
 * لـ٧ أيام بتخلّي التشغيل اليومي كافيًا — بس التذكيرة بتوصل متأخرة
 * أكتر. لو الخطة اتطوّرت، رجّع الجدول لكل ساعة في vercel.json.
 */

export type ReminderResult = { sent: number; skipped: number; errors: number }

/**
 * جملة التذكيرة حسب الخطوة اللي وقف عندها.
 *
 * التذكيرة الواحدة اللي بتتقال للكل بتخاطب حد ما وصلش لحاجة —
 * فاللي ملا عنوانه ووصل للدفع بيحسّ إن المتجر مش شايفه. وهو
 * بالذات أقرب واحد للشرا، فخسارته أغلى.
 */
const RESUME_LINE: Record<CheckoutStage, string> = {
  cart: 'سيبت المنتجات دي في سلتك ومكمّلتش الطلب. لسه موجودة — كمّل في ثانية.',
  contact: 'بياناتك اتحفظت وفاضل عنوان التوصيل بس. كمّل من هنا وطلبك يبقى في السكة.',
  address: 'عنوانك متسجّل وطلبك جاهز — فاضل تختار طريقة الدفع وتأكّد بس.',
  payment: 'طلبك وقف عند خطوة الدفع. لو حصلت مشكلة، جرّب تاني من هنا أو اختار الدفع عند الاستلام.',
}

export async function sendAbandonedCartReminders(limit = 50): Promise<ReminderResult> {
  const result: ReminderResult = { sent: 0, skipped: 0, errors: 0 }
  if (!isEmailConfigured()) return result

  const candidates = await db
    .select({
      id: orders.id,
      storeId: orders.storeId,
      orderNumber: orders.orderNumber,
      customerName: orders.customerName,
      customerEmail: orders.customerEmail,
      total: orders.total,
      currency: orders.currency,
      recoveryToken: orders.recoveryToken,
      checkoutStage: orders.checkoutStage,
      customerId: orders.customerId,
      storeName: stores.name,
      storeEmail: stores.email,
      storeSlug: stores.slug,
      storeLogo: stores.logoLight,
      storeDomain: stores.customDomain,
      storeDomainVerifiedAt: stores.customDomainVerifiedAt,
    })
    .from(orders)
    .innerJoin(stores, eq(stores.id, orders.storeId))
    .where(
      and(
        eq(orders.isIncomplete, true),
        eq(orders.remindersSent, 0),
        isNotNull(orders.customerEmail),
        // بين ساعة و٧ أيام من وقت الترك
        lt(orders.abandonedAt, sql`now() - interval '1 hour'`),
        sql`${orders.abandonedAt} > now() - interval '7 days'`,
        eq(stores.isPublished, true),
      ),
    )
    .limit(limit)

  for (const cart of candidates) {
    try {
      const items = await db
        .select({
          name: orderItems.name,
          quantity: orderItems.quantity,
          total: orderItems.total,
          options: orderItems.options,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, cart.id))

      if (items.length === 0) {
        result.skipped++
        continue
      }

      const theme = await getStoreTheme(cart.storeId)
      const mail = abandonedCartEmail(
        { name: cart.storeName, logo: cart.storeLogo, primary: theme.custom.identity.primary, email: cart.storeEmail, slug: cart.storeSlug },
        {
          customerName: cart.customerName,
          lines: items,
          total: cart.total,
          currency: cart.currency,
          stageLine: RESUME_LINE[cart.checkoutStage ?? 'cart'],
          resumeUrl: `${publicStoreUrl({
            slug: cart.storeSlug,
            customDomain: cart.storeDomain,
            customDomainVerifiedAt: cart.storeDomainVerifiedAt,
          })}/checkout?resume=${encodeURIComponent(cart.recoveryToken ?? '')}`,
        },
      )

      // محفّز الأتمتة على السلة المتروكة — التاجر ممكن يضيف كوبون مثلًا
      runAutomations('cart.abandoned', {
        storeId: cart.storeId,
        storeName: cart.storeName,
        storeSlug: cart.storeSlug,
        currency: cart.currency,
        orderId: cart.id,
        orderNumber: cart.orderNumber,
        orderTotal: cart.total,
        itemCount: items.reduce((n, i) => n + i.quantity, 0),
        customerName: cart.customerName,
        customerEmail: cart.customerEmail,
        recoveryToken: cart.recoveryToken,
      })

      /**
       * رمز إلغاء الاشتراك — بيتولّد أول مرة بس.
       *
       * جيميل بيشترط «إلغاء بضغطة» على المرسلين، والترويسة لازم
       * تشاور على عنوان بيشتغل. بنولّده هنا لا وقت التسجيل: أغلب
       * العملاء ما بيوصلهمش أي رسالة تسويقية أصلًا، فما نملاش الجدول
       * أرقامًا عشوائية ما اتشافتش.
       */
      let unsubscribeUrl: string | null = null
      if (cart.customerId) {
        const token = generateToken(24)
        const [row] = await db
          .update(customers)
          .set({ unsubscribeToken: hashToken(token) })
          .where(and(eq(customers.id, cart.customerId), isNull(customers.unsubscribeToken)))
          .returning({ id: customers.id })

        if (row) unsubscribeUrl = `${appUrl()}/api/unsubscribe?t=${token}`
      }

      const sent = await sendEmail({
        senderAddress: await storeSenderAddress(cart.storeId),
        /* تسويقية — العميل ما طلبهاش، فليها إلغاء اشتراك */
        bulk: true,
        unsubscribeUrl,
        to: cart.customerEmail!,
        ...mail,
        log: { storeId: cart.storeId, event: 'abandoned_cart', orderId: cart.id },
      })

      /**
       * بنسجّل المحاولة سواء نجحت أو فشلت.
       *
       * لو سجّلنا الناجح بس، سلة بتفشل باستمرار (بريد غلط مثلًا) هتفضل
       * تتحاول كل مرة للأبد وتستهلك حصّة الإرسال.
       */
      await db
        .update(orders)
        .set({ remindersSent: 1, lastReminderAt: new Date() })
        .where(eq(orders.id, cart.id))

      if (sent.ok) result.sent++
      else result.errors++
    } catch (e) {
      console.error('فشل تذكير السلة', cart.id, e)
      result.errors++
    }
  }

  return result
}
