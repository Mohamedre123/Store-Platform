import 'server-only'
import { and, eq, gte, sql } from 'drizzle-orm'
import { db } from '@/db'
import { messageLog } from '@/db/schema'
import { catalogBlock, briefLine, type StoreBrief } from './store-context'

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

export function buildBotSystem(brief: StoreBrief, storeName: string): string {
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
    '- **اتكلم في المتجر ومنتجاته بس.** أي سؤال بره ده (أخبار، رياضة، برمجة،',
    '  رأي في حاجة، أي موضوع عام) رد عليه: «أنا بساعد في منتجات المتجر بس 🙂»',
    '  وارجع تسأله محتاج إيه.',
    '- الأسعار والتوفّر من القايمة اللي فوق بالظبط. **ما تخترعش سعر ولا منتج**',
    '  ولا مقاس ولا لون مش مذكور. لو مش لاقي المعلومة، قول إنك مش متأكد',
    '  واقترح إنه يكلّم المتجر.',
    '- ما تعِدش بخصم ولا شحن مجاني ولا موعد تسليم من عندك.',
    '- لو المنتج نفدت كميته، قول كده بصراحة واقترح بديل من القايمة.',
    '- ما تطلبش من العميل أي بيانات شخصية ولا أرقام بطاقات.',
    '',
    'لو العميل طلب حاجة عايز يشتريها، وجّهه إنه يفتحها من المتجر ويضيفها للسلة.',
  ].join('\n')
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
