import 'server-only'

/**
 * سحب طابور المهام مع حركة الموقع.
 *
 * ## المشكلة
 * المهام المؤجّلة (طلب تأكيد الطلب بعد دقيقة، إعادة محاولة الشحنة،
 * الأتمتة المؤجّلة) بتستنى عاملًا يسحبها. والعامل المجدول بيجري على
 * فترات متباعدة، فرسالة المفروض تطلع بعد دقيقة ممكن تستنى ساعات.
 *
 * ## و`after()` ما نفعتش
 * كانت النبضة شغل مؤجّل لبعد الرد جوّه تخطيط المتجر. اشتغلت محليًا،
 * وعلى الاستضافة **لأ**: جرّبنا أربع زيارات متباعدة على الإنتاج، وكل
 * واحدة اتولّدت طازة (`X-Vercel-Cache: MISS`) — يعني التخطيط اشتغل
 * والنبضة اتنادت — والطابور فضل `pending` بـ`attempts: 0` ما اتلمسش.
 *
 * الشغل اللي بيتأجّل لبعد الرد بيموت مع الدالة. والمهمة اللي بتستنّى
 * دقيقة مالهاش قيمة لو العامل اللي هيسحبها بيتقتل قبل ما يبدأ.
 *
 * ## الحل: نداء منتظَر في مسار حقيقي
 * `/api/track` بيتنده من متصفح كل زائر مع كل زيارة. السحب جوّاه
 * **بننتظره**، فبيتنفّذ فعلًا. والزائر مش مستنّي حاجة: `sendBeacon`
 * بتبعت وتمشي، والرد ٢٠٤ فاضي أصلًا.
 *
 * ## والمهلة
 * عشرين ثانية بين السحبة والتانية **لكل نسخة**. من غيرها، متجر عليه
 * ضغط كان هيعمل استعلام طابور مع كل حدث. والرقم مش دقيق بين النسخ —
 * وده مقبول: القفل في `claim` بيمنع إن اتنين ياخدوا نفس المهمة، فأسوأ
 * حالة استعلام زيادة لا تنفيذ مزدوج.
 */

let lastDrain = 0
const EVERY_MS = 20_000

export async function drainDueJobs(): Promise<void> {
  const now = Date.now()
  if (now - lastDrain < EVERY_MS) return
  lastDrain = now

  /**
   * أثر السحب في قاعدة البيانات لا في سجل الخادم وبس.
   *
   * قعدنا ندوّر على «العامل بيجري ولا لأ» على الاستضافة ومفيش أي طريقة
   * نعرف: `console.log` بيروح لسجل مش قدامنا، والطابور اللي ما بيتحرّكش
   * ما بيفرّقش بين «ما اتنادتش» و«اتنادت ورمت».
   *
   * السطر ده بيخلّي السؤال له إجابة: صف في سجل الرسايل بيقول السحب
   * اشتغل ولقى كام مهمة، أو وقع وليه.
   */
  const trace = async (event: string, body: string, failed = false) => {
    try {
      const { db } = await import('@/db')
      const { messageLog } = await import('@/db/schema')
      const { stores } = await import('@/db/schema')
      const { sql } = await import('drizzle-orm')
      const [anyStore] = await db.select({ id: stores.id }).from(stores).limit(1)
      if (!anyStore) return
      await db.insert(messageLog).values({
        storeId: anyStore.id,
        channel: 'system',
        event,
        recipient: '-',
        body: body.slice(0, 400),
        status: failed ? 'failed' : 'sent',
        sentAt: sql`now()`,
      })
    } catch {
      /* التتبّع نفسه ما يصحّش يوقّع السحب */
    }
  }

  try {
    const { drainJobs } = await import('./jobs')
    const summary = await drainJobs(5)

    /*
      بنسجّل لما نسحب فعلًا.

      قعدنا ندوّر على سبب إن طلب التأكيد مش بيتبعت، والطابور كان فيه
      مهام `pending` بـ`attempts: 0` — أثر بيقول «محدّش لمسني» لا
      «حاولت وفشلت». ومكانش فيه أي سطر يقول إن السحب اشتغل ولا لأ،
      فالسؤال «العامل بيجري؟» مكانش ليه إجابة غير التخمين.
    */
    if (summary.picked > 0) {
      await trace(
        'job_drain',
        `سحب ${summary.picked} · نجح ${summary.done} · فشل ${summary.failed}`,
      )
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('فشل سحب الطابور:', e)
    await trace('job_drain_error', msg, true)
  }
}
