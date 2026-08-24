import 'server-only'
import { and, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { messageLog } from '@/db/schema'
import { briefLine, catalogBlock, catalogIsComplete, type StoreBrief } from './store-context'

/**
 * بوت المتجر.
 *
 * مش متدرّب على المتجر — إحنا بنحطّ الكتالوج قدامه مع كل سؤال.
 * النتيجة عند العميل واحدة (بيعرف الأسعار والمخزون)، بس من غير أي
 * تدريب ولا انتظار ولا تكلفة إضافية.
 *
 * وأهم قيد: **بيرد على اللي في المتجر بس.** بوت بيتكلم في أي حاجة
 * بيتحوّل للعبة، وبيستهلك رصيد التاجر في كلام مالوش علاقة ببيعه.
 */

/**
 * العلامة اللي البوت بيحطّها لما يقول «مش موجود».
 *
 * بتتشال من الرد قبل ما يوصل للعميل، وبتتحوّل لزر واتساب. الطريقة
 * دي أدق من إن الخادم يحاول يخمّن من نص الرد: البوت هو الوحيد
 * اللي عارف إنه قال «مش عندنا» ولا «أيوه عندنا».
 *
 * ولو نسيها، مفيش حاجة بتتكسر — الزر مش بيظهر وبس.
 */
export const WA_MARKER = '[[wa]]'

export function buildBotSystem(
  brief: StoreBrief,
  storeName: string,
  /** المتجر مربوط بواتساب؟ من غيره ما نوعدش العميل بحاجة مش موجودة */
  hasWhatsapp: boolean,
): string {
  const complete = catalogIsComplete(brief)

  return [
    `إنت مساعد بيع في متجر «${storeName}» بتتكلم مع عميل.`,
    '',
    `عن المتجر: ${briefLine(brief)}`,
    '',
    'المنتجات المتاحة وأسعارها:',
    catalogBlock(brief),
    '',
    'قواعد ملزمة:',
    '- رد بالعربي المصري، قصير وودود. جملتين أو تلاتة بحد أقصى.',
    '- **خلّص جملتك دايمًا.** رد ناقص واقف في نص الكلام بيخلّي العميل',
    '  يفتكر إن الموقع باظ — اختصر من الأول أحسن ما تتقطع في الآخر.',
    '- **اتكلم في المتجر ومنتجاته بس.** أي سؤال بره ده (أخبار، رياضة، برمجة،',
    '  رأي في حاجة، أي موضوع عام) رد عليه: «أنا بساعد في منتجات المتجر بس 🙂»',
    '  وارجع تسأله محتاج إيه.',
    '- الأسعار والتوفّر من القايمة اللي فوق بالظبط. **ما تخترعش سعر ولا منتج**',
    '  ولا مقاس ولا لون مش مذكور.',

    /*
      دي القاعدة اللي كانت بتخلّي البوت يتمتم.

      «قول إنك مش متأكد» كانت مكتوبة على طول، فالبوت بيقولها حتى لما
      يكون شايف الكتالوج كله قدامه. العميل بيسأل عن منتج، والبوت
      عنده منتج واحد وشايفه، وبيرد «مش متأكد من توفره» — فالعميل
      يفتكر إن المتجر مش عارف بضاعته.

      دلوقتي القاعدة بتتغيّر حسب اللي البوت **فعلًا** يعرفه.
    */
    ...(complete
      ? [
          '- **إنت شايف كل منتجات المتجر.** فأي حاجة مش في القايمة دي معناها',
          '  إنها مش معروضة في المتجر. قولها كده بوضوح وثقة — «مش عندنا حاليًا»',
          '  أو «المتجر فيه X بس» — ومتقولش «مش متأكد».',
          '- بعد ما تقول إن حاجة مش معروضة، اقترح أقرب بديل من القايمة لو فيه.',
        ]
      : [
          '- القايمة اللي فوق مش كل المنتجات. لو العميل سأل عن حاجة مش فيها،',
          '  قول إنك ما لقتهاش في اللي قدامك ومش متأكد إنها مش موجودة خالص.',
        ]),

    ...(hasWhatsapp
      ? [
          `- **لما تقول إن حاجة مش معروضة أو مش متأكد منها، اقفل ردك بـ${WA_MARKER}`,
          '  بالظبط كده في آخر سطر.** ده بيحوّل ردك لزر واتساب يكلّم بيه المتجر',
          '  ويتأكد. ما تكتبش رقم واتساب ولا رابط بنفسك — العلامة دي بتعمل ده.',
          `  ${WA_MARKER} في نهاية الرد بس، ومرة واحدة، ولما تكون فعلًا مش معروض.`,
        ]
      : ['- ما تعرضش على العميل إنه يكلّم المتجر على واتساب — مفيش رقم مربوط.']),

    '- ما تعِدش بخصم ولا شحن مجاني ولا موعد تسليم من عندك.',
    '- لو المنتج نفدت كميته، قول كده بصراحة واقترح بديل من القايمة.',
    '- ما تطلبش من العميل أي بيانات شخصية ولا أرقام بطاقات.',
    '',
    'لو العميل طلب حاجة عايز يشتريها، وجّهه إنه يفتحها من المتجر ويضيفها للسلة.',
  ].join('\n')
}

/**
 * بيفصل علامة الواتساب عن الرد.
 *
 * بنشيلها مهما كان مكانها في الرد: الموديل ساعات بيحطّها في النص أو
 * يكرّرها، والعميل ما يصحّش يشوف `[[wa]]` مكتوبة في المحادثة.
 */
export function splitWhatsappMarker(reply: string): { text: string; offer: boolean } {
  if (!reply.includes(WA_MARKER)) return { text: reply.trim(), offer: false }

  return {
    text: reply.split(WA_MARKER).join('').replace(/\n{3,}/g, '\n\n').trim(),
    offer: true,
  }
}

/**
 * فحص الحدود.
 *
 * بيحمي رصيد التاجر من ناحيتين: زائر واحد بيلعب، ويوم كامل عليه
 * حركة. الاتنين بيتقاسوا من سجل الرسايل — نفس الجدول اللي بيسجّل
 * الإيميلات، فمفيش عدّاد تاني لازم يتظبّط ويتنضّف.
 */
export type LimitCheck =
  | { ok: true }
  | { ok: false; reason: 'daily' | 'visitor'; message: string }

export async function checkLimits(input: {
  storeId: string
  visitorId: string
  dailyLimit: number
  visitorLimit: number
}): Promise<LimitCheck> {
  const dayStart = new Date()
  dayStart.setHours(0, 0, 0, 0)

  const [counts] = await db
    .select({
      today: sql<number>`count(*)::int`,
      thisVisitor: sql<number>`count(*) filter (where ${messageLog.recipient} = ${input.visitorId})::int`,
    })
    .from(messageLog)
    .where(
      and(
        eq(messageLog.storeId, input.storeId),
        eq(messageLog.channel, 'chat'),
        gte(messageLog.createdAt, dayStart),
      ),
    )

  if (Number(counts?.thisVisitor ?? 0) >= input.visitorLimit) {
    return {
      ok: false,
      reason: 'visitor',
      message: 'وصلت لأقصى عدد أسئلة في الجلسة دي. كلّمنا على واتساب وهنساعدك فورًا.',
    }
  }

  if (Number(counts?.today ?? 0) >= input.dailyLimit) {
    return {
      ok: false,
      reason: 'daily',
      message: 'المساعد مشغول دلوقتي. كلّمنا على واتساب وهنرد عليك على طول.',
    }
  }

  return { ok: true }
}

/**
 * تقييد الرسالة.
 *
 * بنسجّل السؤال لا الرد: التاجر بيحتاج يعرف عملاؤه بيسألوا عن إيه —
 * ده أهم تقرير في البوت كله، وبيوريه المنتجات اللي ناقصها وصف.
 */
export async function logBotMessage(input: {
  storeId: string
  visitorId: string
  question: string
  status: 'sent' | 'failed'
  error?: string
}): Promise<void> {
  try {
    await db.insert(messageLog).values({
      storeId: input.storeId,
      channel: 'chat',
      event: 'store_bot',
      // معرّف الزائر مكان المستقبِل — بيه بنعدّ حد الزائر
      recipient: input.visitorId.slice(0, 64),
      body: input.question.slice(0, 500),
      status: input.status,
      provider: 'gemini',
      errorMessage: input.error?.slice(0, 300) ?? null,
      sentAt: input.status === 'sent' ? new Date() : null,
    })
  } catch (e) {
    console.error('فشل تسجيل رسالة البوت:', e)
  }
}
