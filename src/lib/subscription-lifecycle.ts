import 'server-only'
import { and, eq, gt, isNotNull, isNull, lte, ne } from 'drizzle-orm'
import { db } from '@/db'
import { platformSettings, stores } from '@/db/schema'
import { expireSubscriptions } from './subscription'
import { deliverSubscriptionNotice, type NoticeKind } from './subscription-notify'

/**
 * دورة الاشتراك الدورية: إنهاء اللي خلص + تذكيرات قبل الانتهاء + رسالة الانتهاء.
 *
 * ## التذكيرات بالتواريخ لا بالأحداث
 * مفيش «حدث» اسمه فاضل ٧ أيام. بندوّر على المتاجر اللي نهاية فترتها
 * جوّه النافذة، والجدول بيمنع إن نفس التذكير يتبعت مرتين لنفس الفترة.
 * فلو المهمة وقفت يوم، التذكير بيتبعت أول ما ترجع — مش بيضيع.
 *
 * - مدفوع: قبل ٧ أيام، و٣، ويوم.
 * - التجربة (٣ أيام أصلًا): قبل يوم بس — تذكير «فاضل ٣ أيام» يوم ما
 *   بدأت كان هيبقى إزعاج.
 * - الانتهاء: خلال ٣ أيام من نهاية الفترة، ومش للموقوف (الإيقاف له رسالته).
 *
 * ## ومش في نص الليل
 * بتتنادى من العامل اللي بيشتغل طول اليوم، والواتساب الساعة ٣ الفجر
 * بيتقري إزعاج. الرسايل بتستنى لحد ما الساعة تبقى بين ١٠ الصبح و١٠
 * بالليل بتوقيت القاهرة.
 */

const DAY = 86_400_000
const LAST_RUN_KEY = 'subscription_lifecycle_at'

function cairoHour(now = new Date()): number {
  const h = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: 'numeric', hourCycle: 'h23' }).format(now)
  return Number(h)
}

function reminderKind(msLeft: number, trial: boolean): NoticeKind | null {
  if (msLeft <= 0) return null
  if (msLeft <= DAY) return 'reminder_1'
  if (trial) return null
  if (msLeft <= 3 * DAY) return 'reminder_3'
  if (msLeft <= 7 * DAY) return 'reminder_7'
  return null
}

async function throttled(minutes: number): Promise<boolean> {
  const [row] = await db
    .select({ value: platformSettings.value })
    .from(platformSettings)
    .where(eq(platformSettings.key, LAST_RUN_KEY))
    .limit(1)
  const last = row ? Number(row.value) : 0
  if (Date.now() - last < minutes * 60_000) return true
  await db
    .insert(platformSettings)
    .values({ key: LAST_RUN_KEY, value: String(Date.now()) })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value: String(Date.now()), updatedAt: new Date() } })
  return false
}

export async function runSubscriptionLifecycle(opts: { minIntervalMinutes?: number } = {}): Promise<{
  expired: number
  sent: number
  skipped?: string
}> {
  const { expired } = await expireSubscriptions()

  const hour = cairoHour()
  if (hour < 10 || hour >= 22) return { expired, sent: 0, skipped: 'quiet_hours' }
  if (opts.minIntervalMinutes && (await throttled(opts.minIntervalMinutes))) {
    return { expired, sent: 0, skipped: 'throttled' }
  }

  const now = new Date()
  const soon = new Date(now.getTime() + 7 * DAY)
  const recent = new Date(now.getTime() - 3 * DAY)
  let sent = 0

  /* مدفوع شغّال — تذكير */
  const paid = await db
    .select({ id: stores.id, until: stores.subscribedUntil, plan: stores.plan })
    .from(stores)
    .where(and(isNull(stores.deletedAt), ne(stores.status, 'suspended'), gt(stores.subscribedUntil, now), lte(stores.subscribedUntil, soon)))
  for (const s of paid) {
    const kind = reminderKind(s.until!.getTime() - now.getTime(), false)
    if (kind && (await deliverSubscriptionNotice({ storeId: s.id, kind, until: s.until!, planKey: s.plan, trial: false }))) sent++
  }

  /* تجربة شغّالة (ومفيش اشتراك مدفوع بعدها) — تذكير قبل يوم */
  const trials = await db
    .select({ id: stores.id, until: stores.trialEndsAt })
    .from(stores)
    .where(
      and(
        isNull(stores.deletedAt),
        eq(stores.status, 'trial'),
        gt(stores.trialEndsAt, now),
        lte(stores.trialEndsAt, new Date(now.getTime() + DAY)),
      ),
    )
  for (const s of trials) {
    if (await deliverSubscriptionNotice({ storeId: s.id, kind: 'reminder_1', until: s.until!, trial: true })) sent++
  }

  /* مدفوع خلص قريب — انتهى */
  const ended = await db
    .select({ id: stores.id, until: stores.subscribedUntil, plan: stores.plan })
    .from(stores)
    .where(and(isNull(stores.deletedAt), ne(stores.status, 'suspended'), ne(stores.status, 'active'), isNotNull(stores.subscribedUntil), gt(stores.subscribedUntil, recent), lte(stores.subscribedUntil, now)))
  for (const s of ended) {
    if (await deliverSubscriptionNotice({ storeId: s.id, kind: 'expired', until: s.until!, planKey: s.plan, trial: false })) sent++
  }

  /* تجربة خلصت من غير اشتراك */
  const trialEnded = await db
    .select({ id: stores.id, until: stores.trialEndsAt })
    .from(stores)
    .where(and(isNull(stores.deletedAt), ne(stores.status, 'suspended'), ne(stores.status, 'active'), isNull(stores.subscribedUntil), gt(stores.trialEndsAt, recent), lte(stores.trialEndsAt, now)))
  for (const s of trialEnded) {
    if (await deliverSubscriptionNotice({ storeId: s.id, kind: 'trial_ended', until: s.until!, trial: true })) sent++
  }

  return { expired, sent }
}
