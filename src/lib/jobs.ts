import 'server-only'
import { and, asc, eq, lte, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { jobQueue } from '@/db/schema'

/**
 * طابور المهام.
 *
 * **ليه نحتاجه أصلًا؟** لأن فيه شغل ما ينفعش يتعمل في نفس لحظة
 * الطلب: «ابعت تذكير بعد ساعتين»، «حاول تسجّل الشحنة تاني بعد
 * خمس دقايق». الدالة اللي بتشتغل مع الطلب بتنتهي مع الرد — أي
 * `setTimeout` جوّاها بيموت مع انتهاء الدالة على Vercel.
 *
 * الطابور بيخزّن الشغل في قاعدة البيانات، والعامل (cron) بيسحب
 * اللي حان وقته وينفّذه.
 *
 * ثلاث قواعد:
 *
 * ١. **السحب بقفل ذرّي.** عاملين بينادوا في نفس اللحظة (Vercel
 *    بتشغّل نسخ متوازية) لازم ما ياخدوش نفس المهمة — وإلا التذكير
 *    بيتبعت مرتين. القفل جزء من جملة `UPDATE` واحدة بشرط، فمفيش
 *    فرصة لاتنين ياخدوا نفس الصف.
 * ٢. **الفشل بيعيد المحاولة بتباعد متزايد.** المزوّد الواقع بيرجع
 *    بعد شوية؛ إعادة المحاولة كل دقيقة بتضربه وهو واقع وبتستهلك
 *    حصّتنا.
 * ٣. **المهمة اللي خلصت محاولاتها بتتعلّم «فشلت» ومابتتشالش.** سبب
 *    الفشل هو اللي بيقول للتاجر إيه اللي حصل.
 */

export type JobType =
  | 'shipment.retry'
  | 'automation.delayed'
  | 'webhook.retry'
  | 'catalog.sync'
  | 'order.confirm_request'

/** يحجز مهمة للتنفيذ بعد مدة */
export async function enqueue(input: {
  storeId: string | null
  type: JobType
  payload: Record<string, unknown>
  /** بعد كام دقيقة تشتغل — صفر يعني حالًا */
  delayMinutes?: number
  maxAttempts?: number
}): Promise<string> {
  const runAt = new Date(Date.now() + (input.delayMinutes ?? 0) * 60_000)

  const [row] = await db
    .insert(jobQueue)
    .values({
      storeId: input.storeId,
      type: input.type,
      payload: input.payload,
      runAt,
      maxAttempts: input.maxAttempts ?? 5,
    })
    .returning({ id: jobQueue.id })

  return row.id
}

/**
 * القفل الميت.
 *
 * المهمة اللي اتقفلت ومات العامل قبل ما يخلّصها بتفضل «شغّالة»
 * للأبد. بعد عشر دقايق بنعتبر القفل ميتًا ونسمح بسحبها تاني —
 * أطول من أي مهمة عندنا بكتير، فمفيش خطر تنفيذ مزدوج.
 */
const LOCK_TIMEOUT_MS = 10 * 60_000

/**
 * يسحب دفعة مهام ويقفلها في نفس الجملة.
 *
 * `FOR UPDATE SKIP LOCKED` بيخلّي كل عامل ياخد صفوفًا مختلفة من
 * غير ما يستنّى التاني — ده اللي بيخلّي تشغيل نسختين متوازيتين
 * أسرع بدل ما يبقى واحد واقف على التاني.
 */
async function claim(limit: number) {
  const deadLock = new Date(Date.now() - LOCK_TIMEOUT_MS)

  const rows = await db
    .select({ id: jobQueue.id })
    .from(jobQueue)
    .where(
      and(
        or(eq(jobQueue.status, 'pending'), and(eq(jobQueue.status, 'running'), lte(jobQueue.lockedAt, deadLock))),
        lte(jobQueue.runAt, new Date()),
      ),
    )
    .orderBy(asc(jobQueue.runAt))
    .limit(limit)

  if (rows.length === 0) return []

  const ids = rows.map((r) => r.id)

  const locked = await db
    .update(jobQueue)
    .set({ status: 'running', lockedAt: new Date(), attempts: sql`${jobQueue.attempts} + 1` })
    .where(
      and(
        sql`${jobQueue.id} = any(${ids})`,
        // الشرط ده هو القفل: الصف اللي حد سبقنا عليه مش هيتحدّث
        or(eq(jobQueue.status, 'pending'), and(eq(jobQueue.status, 'running'), lte(jobQueue.lockedAt, deadLock))),
      ),
    )
    .returning({
      id: jobQueue.id,
      storeId: jobQueue.storeId,
      type: jobQueue.type,
      payload: jobQueue.payload,
      attempts: jobQueue.attempts,
      maxAttempts: jobQueue.maxAttempts,
    })

  return locked
}

/** تباعد متزايد: ١ ← ٤ ← ٩ ← ١٦ دقيقة… */
function backoffMinutes(attempts: number): number {
  return Math.min(attempts * attempts, 60)
}

export type JobResult = { ok: true } | { ok: false; error: string }

type Handler = (
  payload: Record<string, unknown>,
  storeId: string | null,
) => Promise<JobResult>

/**
 * منفّذات المهام.
 *
 * الاستيراد كسول (`await import`) عن قصد: مسار الـcron بيتحمّل في
 * كل نداء، وتحميل كل التكاملات في كل مرة عشان مهمة واحدة بيبطّئ
 * البداية الباردة على الفاضي.
 */
const HANDLERS: Record<string, Handler> = {
  'shipment.retry': async (payload, storeId) => {
    if (!storeId || typeof payload.orderId !== 'string') return { ok: false, error: 'حمولة ناقصة' }
    const { queueShipmentForOrder } = await import('./shipment-dispatch')
    const res = await queueShipmentForOrder(storeId, payload.orderId)
    return res.ok ? { ok: true } : { ok: false, error: res.error ?? 'ما اتسجّلتش' }
  },

  'automation.delayed': async (payload) => {
    const { runAutomationsNow } = await import('./automation')
    const mod = await import('./automation-defs')
    const trigger = String(payload.trigger ?? '')
    if (!mod.TRIGGERS.some((t) => t.key === trigger)) {
      return { ok: false, error: 'محفّز غير معروف: ' + trigger }
    }
    await runAutomationsNow(
      trigger as Parameters<typeof runAutomationsNow>[0],
      payload.ctx as Parameters<typeof runAutomationsNow>[1],
    )
    return { ok: true }
  },

  'webhook.retry': async (payload, storeId) => {
    if (!storeId || typeof payload.event !== 'string') return { ok: false, error: 'حمولة ناقصة' }
    const { dispatchWebhook, WEBHOOK_EVENTS } = await import('./webhooks')

    /*
      الحدث بيتحقّق منه قبل التنفيذ.

      الحمولة جاية من قاعدة البيانات، وممكن تكون اتكتبت بنسخة أقدم
      من الكود أو حدث اتشال. التمرير من غير تحقّق كان بيبعت حدثًا
      مالوش معنى لسيرفر التاجر — وسيرفره بيرد بخطأ فنعيد المحاولة
      خمس مرات على الفاضي.
    */
    const event = payload.event
    if (!WEBHOOK_EVENTS.some((e) => e.key === event)) {
      return { ok: false, error: 'حدث غير معروف: ' + event }
    }

    dispatchWebhook(
      storeId,
      event as Parameters<typeof dispatchWebhook>[1],
      payload.data ?? {},
    )
    return { ok: true }
  },

  /*
    طلب تأكيد الطلب من العميل — بعد مهلة من لحظة الطلب.

    المهلة مقصودة: الرسالة اللي بتوصل في نفس ثانية الطلب بتوصل مع
    رسالة التأكيد العادية، فالعميل بيشوف اتنين مع بعض ويحتار. وكمان
    اللي بيطلب وبيغيّر رأيه بيلغي بنفسه في أول دقايق — فالمهلة
    بتوفّر رسالة على حد أصلًا مش هيكمّل.
  */
  'order.confirm_request': async (payload, storeId) => {
    if (!storeId || typeof payload.orderId !== 'string') return { ok: false, error: 'حمولة ناقصة' }
    const { requestConfirmation } = await import('./order-confirm')
    const res = await requestConfirmation({ storeId, orderId: payload.orderId })

    /*
      «ردّ خلاص» و«مالوش رقم» مش أعطال — بنعتبرها نجاحًا عشان
      الطابور ما يفضلش يعيد المحاولة خمس مرات على حاجة مالهاش حل.
    */
    if (res.ok) return { ok: true }
    if (/ردّ|رقم تليفون|مش موجود|ناقص|مش مربوط/.test(res.error)) return { ok: true }
    return { ok: false, error: res.error }
  },

  'catalog.sync': async (payload, storeId) => {
    if (!storeId) return { ok: false, error: 'حمولة ناقصة' }
    const { touchCatalogFeed } = await import('./marketplace')
    await touchCatalogFeed(storeId, String(payload.platform ?? ''))
    return { ok: true }
  },
}

export type DrainSummary = { picked: number; done: number; failed: number; retried: number }

/** يشغّل دفعة من الطابور. بيتنادى من الـcron */
export async function drainJobs(limit = 25): Promise<DrainSummary> {
  const jobs = await claim(limit)
  const summary: DrainSummary = { picked: jobs.length, done: 0, failed: 0, retried: 0 }

  for (const job of jobs) {
    const handler = HANDLERS[job.type]

    if (!handler) {
      await db
        .update(jobQueue)
        .set({ status: 'failed', lastError: `نوع مهمة غير معروف: ${job.type}`, completedAt: new Date() })
        .where(eq(jobQueue.id, job.id))
      summary.failed++
      continue
    }

    let result: JobResult
    try {
      result = await handler(job.payload ?? {}, job.storeId)
    } catch (e) {
      result = { ok: false, error: e instanceof Error ? e.message : 'خطأ غير متوقّع' }
    }

    if (result.ok) {
      await db
        .update(jobQueue)
        .set({ status: 'done', lastError: null, completedAt: new Date() })
        .where(eq(jobQueue.id, job.id))
      summary.done++
      continue
    }

    if (job.attempts >= job.maxAttempts) {
      await db
        .update(jobQueue)
        .set({ status: 'failed', lastError: result.error, completedAt: new Date() })
        .where(eq(jobQueue.id, job.id))
      summary.failed++
      continue
    }

    await db
      .update(jobQueue)
      .set({
        status: 'pending',
        lastError: result.error,
        lockedAt: null,
        runAt: new Date(Date.now() + backoffMinutes(job.attempts) * 60_000),
      })
      .where(eq(jobQueue.id, job.id))
    summary.retried++
  }

  return summary
}

/**
 * تنظيف المهام القديمة.
 *
 * اللي خلص من أسبوع مالوش لازمة — والجدول اللي بيكبر بلا حد بيبطّئ
 * السحب نفسه. الفاشل بيتساب أطول: هو الدليل الوحيد على اللي حصل.
 */
export async function pruneJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 3_600_000)
  const rows = await db
    .delete(jobQueue)
    .where(and(eq(jobQueue.status, 'done'), lte(jobQueue.completedAt, cutoff)))
    .returning({ id: jobQueue.id })

  return rows.length
}

/** ملخّص الطابور — بيتعرض للتاجر في صفحة المطوّرين */
export async function queueSummary(storeId: string) {
  const rows = await db
    .select({
      status: jobQueue.status,
      type: jobQueue.type,
      n: sql<number>`count(*)::int`,
    })
    .from(jobQueue)
    .where(eq(jobQueue.storeId, storeId))
    .groupBy(jobQueue.status, jobQueue.type)

  return rows
}

/** آخر المهام الفاشلة — دي اللي التاجر محتاج يشوفها */
export async function recentFailures(storeId: string, limit = 10) {
  return db
    .select({
      id: jobQueue.id,
      type: jobQueue.type,
      lastError: jobQueue.lastError,
      attempts: jobQueue.attempts,
      createdAt: jobQueue.createdAt,
    })
    .from(jobQueue)
    .where(and(eq(jobQueue.storeId, storeId), eq(jobQueue.status, 'failed')))
    .orderBy(sql`${jobQueue.createdAt} desc`)
    .limit(limit)
}
