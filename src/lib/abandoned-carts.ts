import 'server-only'
import { and, eq, isNotNull, lt, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orderItems, orders, stores } from '@/db/schema'
import { getStoreTheme } from './storefront'
import { isEmailConfigured, sendEmail } from './email'
import { abandonedCartEmail } from './store-emails'
import { storeUrl } from './domain'
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
      storeName: stores.name,
      storeSlug: stores.slug,
      storeLogo: stores.logoLight,
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
        .select({ name: orderItems.name, quantity: orderItems.quantity, total: orderItems.total })
        .from(orderItems)
        .where(eq(orderItems.orderId, cart.id))

      if (items.length === 0) {
        result.skipped++
        continue
      }

      const theme = await getStoreTheme(cart.storeId)
      const mail = abandonedCartEmail(
        { name: cart.storeName, logo: cart.storeLogo, primary: theme.custom.identity.primary },
        {
          customerName: cart.customerName,
          lines: items,
          total: cart.total,
          currency: cart.currency,
          resumeUrl: `${storeUrl(cart.storeSlug)}/checkout?resume=${encodeURIComponent(cart.recoveryToken ?? '')}`,
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

      const sent = await sendEmail({ to: cart.customerEmail!, ...mail })

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
