import 'server-only'
import { and, desc, eq, gt, isNotNull, isNull } from 'drizzle-orm'
import { db } from '@/db'
import { orderEvents, orders, stores } from '@/db/schema'
import { sendWhatsapp } from './whatsapp'
import { formatMoney } from './utils'

/**
 * تأكيد الطلب من العميل قبل الشحن.
 *
 * ## الوجع
 * الدفع عند الاستلام معناه إن التاجر بيشحن على أمل. الطلب اللي العميل
 * ما بيردّش عليه بيرجع، والتاجر بيدفع شحن رايح وجاي على حاجة ما
 * اتباعتش. المكالمة بتحل ده — بس مين هيتّصل بمية طلب في اليوم؟
 *
 * الرسالة دي بتاخد التأكيد من غير مكالمة، والرد بيتسجّل على الطلب.
 *
 * ## ليه رقم مش زرار
 * جلسات واتساب ويب (اللي البوابة شغّالة بيها) **مابتدعمش الأزرار
 * التفاعلية** — دي حكر على واتساب بزنس الرسمي بقوالب معتمدة. الرقم
 * أقرب حاجة ليها: العميل بيدوس ١ ويبعت، ضغطتين وخلاص. وحطّينا معاه
 * كلمات («تمام»، «أيوه») لأن ناس بترد بالكلام بطبيعتها.
 */

/** كلمات التأكيد والرفض — بنقارن بعد تنظيف الرسالة */
const YES = ['1', '١', 'نعم', 'ايوه', 'أيوه', 'اه', 'آه', 'تمام', 'موافق', 'اكيد', 'أكيد', 'ok', 'yes']
const NO = ['2', '٢', 'لا', 'لأ', 'الغاء', 'إلغاء', 'مش عايز', 'كنسل', 'no', 'cancel']

/**
 * بيقرا رد العميل.
 *
 * بينضّف المسافات والتشكيل والعلامات، وبيقارن بالكلمة كاملة لا
 * بجزء منها: «لا» جوّه «لازم» مش رفض، و«اه» جوّه «اهلا» مش تأكيد.
 * المقارنة الجزئية هنا كانت هتلغي طلبات صح.
 */
export function readReply(raw: string): 'yes' | 'no' | null {
  const text = raw
    .trim()
    .toLowerCase()
    .replace(/[ً-ْ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  if (!text) return null

  const words = text.split(' ')
  /* الرسالة الطويلة مش رد — «تمام هبعتلك العنوان بكرة» محتاجة بني آدم */
  if (words.length > 3) return null

  if (words.some((w) => YES.includes(w))) return 'yes'
  if (words.some((w) => NO.includes(w))) return 'no'
  return null
}

/**
 * بيبعت طلب التأكيد للعميل.
 *
 * بيرجّع سبب الفشل زي ما هو عشان التاجر يعرف: الجلسة اتفصلت؟ الرقم
 * غلط؟ الرسالة اتبعتت قبل كده؟
 */
export async function requestConfirmation(input: {
  storeId: string
  orderId: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const [order] = await db
    .select({
      id: orders.id,
      number: orders.orderNumber,
      phone: orders.customerPhone,
      name: orders.customerName,
      total: orders.total,
      currency: orders.currency,
      confirm: orders.customerConfirm,
      isIncomplete: orders.isIncomplete,
    })
    .from(orders)
    .where(and(eq(orders.id, input.orderId), eq(orders.storeId, input.storeId)))
    .limit(1)

  if (!order) return { ok: false, error: 'الطلب مش موجود' }
  if (order.isIncomplete) return { ok: false, error: 'الطلب لسه ناقص' }
  if (!order.phone) return { ok: false, error: 'الطلب مالوش رقم تليفون' }
  if (order.confirm) return { ok: false, error: 'العميل ردّ على الطلب ده خلاص' }

  const [store] = await db
    .select({ name: stores.name })
    .from(stores)
    .where(eq(stores.id, input.storeId))
    .limit(1)

  const hello = order.name ? ` ${order.name}` : ''
  const text = [
    `مرحبًا${hello} 👋`,
    `طلبك رقم #${order.number} من ${store?.name ?? 'متجرنا'}`,
    `الإجمالي: ${formatMoney(order.total, order.currency)}`,
    '',
    'عشان نجهّزه ونبعته، أكّدلنا:',
    '*1* — تمام، أكّد الطلب ✅',
    '*2* — لأ، ألغِ الطلب ❌',
    '',
    'ابعت الرقم بس ونحن نكمّل.',
  ].join('\n')

  const res = await sendWhatsapp(input.storeId, order.phone, text, {
    event: 'order_confirm_request',
    orderId: order.id,
  })

  if (!res.ok) return { ok: false, error: res.error }

  await db
    .update(orders)
    .set({ confirmSentAt: new Date() })
    .where(eq(orders.id, order.id))

  await db.insert(orderEvents).values({
    orderId: order.id,
    storeId: input.storeId,
    type: 'message_sent',
    message: 'بعتنا طلب تأكيد للعميل على واتساب',
    actorType: 'system',
  })

  return { ok: true }
}

/**
 * بيلاقي الطلب اللي الرد ده بتاعه.
 *
 * ## ليه آخر طلب مستني
 * الويب هوك بيجيله رقم ورسالة وبس — مفيش رقم طلب في رد العميل. فبناخد
 * **آخر طلب بعتنا له تأكيد ولسه ما ردّش**، وبحد زمني ٤٨ ساعة.
 *
 * الحد الزمني مهم: من غيره، «تمام» بعد أسبوعين في سياق تاني خالص كانت
 * هتأكّد طلبًا قديم منسي — والتاجر يشحنه.
 */
export async function findPendingOrder(phone: string) {
  const cutoff = new Date(Date.now() - 48 * 3600_000)

  const [row] = await db
    .select({
      id: orders.id,
      storeId: orders.storeId,
      number: orders.orderNumber,
      name: orders.customerName,
    })
    .from(orders)
    .where(
      and(
        eq(orders.customerPhone, phone),
        isNotNull(orders.confirmSentAt),
        isNull(orders.customerConfirm),
        gt(orders.confirmSentAt, cutoff),
      ),
    )
    .orderBy(desc(orders.confirmSentAt))
    .limit(1)

  return row ?? null
}

/**
 * بيسجّل رد العميل ويرد عليه.
 *
 * ## «لأ» بتلغي الطلب فورًا
 * العميل قال إنه مش عايزه — الشحن بعدها خسارة مؤكّدة. والتاجر بيشوف
 * السبب في مسار الطلب، ويقدر يرجّعه لو كلّمه واتفقوا.
 *
 * ## و«أيوه» ما بتغيّرش الحالة
 * التأكيد إشارة للتاجر لا أمر تشغيل: هو اللي بيقرّر إمتى يجهّز ويشحن.
 * لو غيّرنا الحالة تلقائي كنا بنتخطّى قراره في متجره.
 */
export async function applyReply(input: {
  orderId: string
  storeId: string
  reply: 'yes' | 'no'
  customerName: string | null
}): Promise<string> {
  const now = new Date()

  await db
    .update(orders)
    .set({
      customerConfirm: input.reply,
      customerConfirmAt: now,
      ...(input.reply === 'no' ? { status: 'cancelled' as const, cancelledAt: now } : {}),
    })
    .where(eq(orders.id, input.orderId))

  await db.insert(orderEvents).values({
    orderId: input.orderId,
    storeId: input.storeId,
    type: input.reply === 'yes' ? 'note' : 'status',
    message:
      input.reply === 'yes'
        ? 'العميل أكّد الطلب على واتساب ✅'
        : 'العميل ألغى الطلب على واتساب ❌',
    actorType: 'customer',
  })

  const hello = input.customerName ? ` ${input.customerName}` : ''
  return input.reply === 'yes'
    ? `تمام${hello}! ✅ طلبك اتأكّد وهنجهّزه ونبعتهولك. هنبعتلك تحديث أول ما يتشحن.`
    : `تمام${hello}، الطلب اتلغى ❌ لو كان في غلط أو غيّرت رأيك، كلّمنا وهنساعدك.`
}
