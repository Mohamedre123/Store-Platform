import 'server-only'
import { sql } from 'drizzle-orm'
import { db } from '@/db'

/**
 * جودة إشارة التحويل — قد إيه أحداثك بتوصل ميتا وتيك توك كاملة.
 *
 * ## السؤال اللي بتجاوب عليه
 * التاجر بيدفع في إعلانات ميتا وبيسأل «ليه الإعلان مش بيجيب؟».
 * نُص الإجابات مش في الإعلان — هي إن **ميتا مش شايفة مبيعاته**،
 * فبتحسّن على اللي بيفتح لا اللي بيشتري.
 *
 * ## والدرجة من تغطية مفاتيح المطابقة
 * ميتا بتطابق الحدث بالعميل بالبريد والتليفون والاسم والمدينة
 * وكوكيز البكسل. كل مفتاح ناقص = عملاء أقل بيتطابقوا = جمهور
 * مشابه أضعف وتحسين أسوأ. الدرجة هنا بتقيس **اللي إحنا بنبعته**
 * لا اللي ميتا بتحسبه — واسمها بيقول كده صراحةً، مش «EMQ».
 *
 * ## وما بنخترعش رقمًا من العدم
 * كل رقم في الشاشة بيتقرا من `store_events.meta.capi` اللي
 * `sendConversion` بتكتبه مع كل طلب. لو المتجر لسه ما ربطش، الشاشة
 * بتقول «مش مربوط» بدل ما تطلّع درجة على بيانات مش موجودة.
 */

export type SignalSnapshot = {
  /** طلبات في النافذة — الأساس اللي كل نسبة بتتحسب عليه */
  purchases: number
  /** اتبعتت للخادم بنجاح */
  delivered: number
  /** اتخطّت لأن المتجر مش مربوط */
  skipped: number
  failed: number
  /** متوسط عدد مفاتيح المطابقة لكل حدث — من ٧ */
  avgMatchKeys: number
  /** الدرجة من ١٠ — تغطية المفاتيح مضروبة في نسبة التسليم */
  score: number | null
  /** كل مفتاح ونسبة الأحداث اللي كان فيها */
  coverage: Array<{ key: string; label: string; hint: string; pct: number }>
  /** آخر الأخطاء زي ما المنصة قالتها */
  errors: Array<{ message: string; count: number }>
}

/** المفاتيح اللي ميتا بتطابق بيها، بترتيب أثرها */
const KEYS: Array<{ key: string; label: string; hint: string }> = [
  { key: 'em', label: 'البريد', hint: 'أقوى مفتاح مطابقة. خانة البريد في الشيك أوت بتزوّده.' },
  { key: 'ph', label: 'التليفون', hint: 'أقوى مفتاح في السوق المصري — أغلب الناس مالهاش بريد نشط.' },
  { key: 'fbp', label: 'كوكي البكسل', hint: 'بتيجي من متصفح العميل. غيابها معناه إن البكسل مش شغّال عنده.' },
  { key: 'fbc', label: 'كوكي الإعلان', hint: 'بتربط الطلب بالضغطة على إعلانك بالظبط.' },
  { key: 'fn', label: 'الاسم الأول', hint: 'من خانة الاسم في الشيك أوت.' },
  { key: 'ln', label: 'اسم العيلة', hint: 'العميل اللي بيكتب اسمًا واحدًا مالوش ده.' },
  { key: 'ct', label: 'المدينة', hint: 'من عنوان الشحن.' },
]

type CapiMeta = {
  sent?: string[]
  skipped?: string[]
  errors?: string[]
  matchKeys?: string[]
}

export async function signalQuality(storeId: string, days = 7): Promise<SignalSnapshot> {
  const rows = await db.execute<{ meta: { capi?: CapiMeta } | null }>(sql`
    select meta
      from store_events
     where store_id = ${storeId}
       and type = 'purchase'
       and created_at >= now() - (${days} || ' days')::interval
     order by created_at desc
     limit 500
  `)

  const events = [...rows].map((r) => r.meta?.capi).filter((c): c is CapiMeta => Boolean(c))

  const purchases = events.length
  if (purchases === 0) {
    return {
      purchases: 0,
      delivered: 0,
      skipped: 0,
      failed: 0,
      avgMatchKeys: 0,
      score: null,
      coverage: KEYS.map((k) => ({ ...k, pct: 0 })),
      errors: [],
    }
  }

  let delivered = 0
  let skipped = 0
  let failed = 0
  let keyTotal = 0
  const perKey = new Map<string, number>()
  const errorCounts = new Map<string, number>()

  for (const e of events) {
    const sent = e.sent ?? []
    const errs = e.errors ?? []

    if (sent.length > 0) delivered += 1
    else if (errs.length > 0) failed += 1
    else skipped += 1

    const keys = e.matchKeys ?? []
    keyTotal += keys.length
    for (const k of keys) perKey.set(k, (perKey.get(k) ?? 0) + 1)

    for (const msg of errs) {
      /*
        الأخطاء بتتجمّع على أول جزء منها.

        نفس الرفض بيتكرر مع كل طلب برسالة فيها معرّف مختلف، فلو
        عرضناها زي ما هي التاجر بيلاقي مية سطر لمشكلة واحدة.
      */
      const short = msg.split(':').slice(0, 2).join(':').slice(0, 120)
      errorCounts.set(short, (errorCounts.get(short) ?? 0) + 1)
    }
  }

  const coverage = KEYS.map((k) => ({
    ...k,
    pct: Math.round(((perKey.get(k.key) ?? 0) / purchases) * 100),
  }))

  /*
    الدرجة = تغطية المفاتيح × نسبة التسليم.

    الضرب لا الجمع: حدث فيه كل المفاتيح وما وصلش يساوي صفر —
    والمتوسط كان هيدّي درجة نص لحاجة قيمتها صفر فعلًا.

    والمقام ٧ لأن دي كل المفاتيح اللي بنبعتها. المتجر اللي بيجمع
    البريد والتليفون والاسم الكامل والمدينة وعنده بكسل شغّال بيوصل
    للسبعة.
  */
  const keyCoverage = keyTotal / (purchases * KEYS.length)
  const deliveryRate = delivered / purchases
  const score = Math.round(keyCoverage * deliveryRate * 10 * 10) / 10

  return {
    purchases,
    delivered,
    skipped,
    failed,
    avgMatchKeys: Math.round((keyTotal / purchases) * 10) / 10,
    score,
    coverage,
    errors: [...errorCounts.entries()]
      .map(([message, count]) => ({ message, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5),
  }
}
