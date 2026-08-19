import 'server-only'
import { createHmac } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { webhooks } from '@/db/schema'

/**
 * الويب هوكس.
 *
 * بنبعت الحدث لكل رابط مشترك فيه، موقّعًا بـHMAC عشان المستقبِل يتأكد
 * إن الرسالة منّنا مش من حد بيتنكّر. التوقيع في ترويسة مستقلة والجسم
 * كما هو، فالمستقبِل يقدر يتحقق قبل ما يفسّر أي حاجة.
 *
 * الإرسال بدون انتظار: الطلب اللي سبّب الحدث (إنشاء طلب مثلًا) ما ينفعش
 * يستنى خادم خارجي بطيء. ولو الرابط فشل كذا مرة بنوقفه تلقائيًا بدل ما
 * نفضل نحاول للأبد.
 */

export { WEBHOOK_EVENTS, type WebhookEvent } from './webhook-events'
import type { WebhookEvent } from './webhook-events'

const MAX_FAILURES = 10
const TIMEOUT_MS = 8000

export function signPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

/**
 * إطلاق حدث لكل الروابط المشتركة فيه.
 *
 * بترجع فورًا — الإرسال بيكمّل في الخلفية. أي فشل بيتسجّل ومش بيأثر
 * على العملية اللي سبّبت الحدث.
 */
export function dispatchWebhook(storeId: string, event: WebhookEvent, data: unknown) {
  void deliver(storeId, event, data).catch((e) =>
    console.error('فشل إرسال الويب هوك:', event, e),
  )
}

async function deliver(storeId: string, event: WebhookEvent, data: unknown) {
  const targets = await db
    .select({ id: webhooks.id, url: webhooks.url, secret: webhooks.secret })
    .from(webhooks)
    .where(
      and(
        eq(webhooks.storeId, storeId),
        eq(webhooks.isActive, true),
        sql`${webhooks.events} @> ${JSON.stringify([event])}::jsonb`,
      ),
    )

  if (targets.length === 0) return

  const body = JSON.stringify({
    event,
    storeId,
    // الطابع الزمني جزء من الحمولة عشان المستقبِل يرفض الرسائل القديمة
    sentAt: new Date().toISOString(),
    data,
  })

  await Promise.all(
    targets.map(async (target) => {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

      try {
        const res = await fetch(target.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Zawya-Event': event,
            'X-Zawya-Signature': signPayload(target.secret, body),
          },
          body,
          signal: controller.signal,
        })

        if (res.ok) {
          await db
            .update(webhooks)
            .set({ failureCount: 0, lastDeliveryAt: new Date() })
            .where(eq(webhooks.id, target.id))
        } else {
          await recordFailure(target.id)
        }
      } catch {
        await recordFailure(target.id)
      } finally {
        clearTimeout(timer)
      }
    }),
  )
}

/** الرابط اللي بيفشل باستمرار بيتوقف — مش هنفضل نحاول للأبد */
async function recordFailure(id: string) {
  const [row] = await db
    .update(webhooks)
    .set({ failureCount: sql`${webhooks.failureCount} + 1` })
    .where(eq(webhooks.id, id))
    .returning({ failureCount: webhooks.failureCount })

  if (row && row.failureCount >= MAX_FAILURES) {
    await db.update(webhooks).set({ isActive: false }).where(eq(webhooks.id, id))
  }
}
