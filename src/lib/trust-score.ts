import 'server-only'
import { and, eq, inArray, ne, sql } from 'drizzle-orm'
import { db } from '@/db'
import { orders } from '@/db/schema'

/**
 * درجة ثقة العميل — قبل ما التاجر يشحن.
 *
 * ## الوجع اللي بتحلّه
 * السوق هنا بيدفع عند الاستلام. يعني التاجر بيشحن على أمل: العميل
 * ممكن ما يردّش، أو يرفض الاستلام، أو يرجّع بعد ما يفتح. وفي كل
 * الحالات دي التاجر **بيدفع شحن رايح وجاي على طلب ما اتباعش** —
 * وده أكبر بند خسارة عنده، ومفيش أي منصة بتقوله عنه حاجة قبل الشحن.
 *
 * الدرجة دي بتخلّي القرار قبل الشحن لا بعده.
 *
 * ## الشبكة — وحدودها
 * الرقم اللي رفض في خمس متاجر أخطر من اللي رفض في واحد. عشان كده
 * بنقرا سجل الرقم على **مستوى المنصة**، بس بشروط صارمة:
 *
 * - **أرقام مجمّعة بس.** عدد الاستلام وعدد الرفض وعدد المتاجر. مفيش
 *   اسم متجر ولا رقم طلب ولا مبلغ ولا تاريخ — التاجر ما يعرفش مين
 *   التجّار التانيين ولا اشترى إيه منهم.
 * - **الرقم هو المفتاح الوحيد.** مفيش اسم ولا عنوان ولا بريد بيعدّي
 *   بين المتاجر.
 *
 * الحد ده مقصود: الفايدة إن التاجر يعرف إن في خطر، مش إنه يتفرّج على
 * عملاء غيره.
 *
 * ## الطلب الملغي مش دايمًا رفض
 * الإلغاء قبل ما التاجر يأكّد ممكن يكون هو نفسه لغاه، أو العميل غيّر
 * رأيه بأدب — ودول ما يتحسبوش على العميل. اللي بيتحسب: الطلب اللي
 * اترجّع، أو اتلغى بعد ما التاجر أكّده والتزم بيه. غير كده كنا هنعاقب عميل ما عملش
 * حاجة، والتاجر يبطّل يثق في الدرجة كلها.
 */

export type TrustLevel = 'new' | 'good' | 'watch' | 'risky'

export type TrustScore = {
  /** من ٠ لـ١٠٠ — أعلى = أأمن. null للعميل الجديد */
  score: number | null
  level: TrustLevel
  /** في متجرك إنت */
  delivered: number
  refused: number
  /** على مستوى المنصة — مجمّع بلا أي تفصيل */
  network: { delivered: number; refused: number; stores: number }
  /** جمل جاهزة للعرض — بتشرح الدرجة بدل ما تسيب التاجر يخمّن */
  reasons: string[]
}

const EMPTY: TrustScore = {
  score: null,
  level: 'new',
  delivered: 0,
  refused: 0,
  network: { delivered: 0, refused: 0, stores: 0 },
  reasons: [],
}

/** الطلب ده يتحسب رفضًا على العميل؟ */
const REFUSED_SQL = sql<number>`count(*) filter (
  where ${orders.status} = 'returned'
     or (${orders.status} = 'cancelled' and ${orders.confirmedAt} is not null)
)`

const DELIVERED_SQL = sql<number>`count(*) filter (where ${orders.status} = 'delivered')`

/**
 * درجات مجموعة أرقام مرة واحدة.
 *
 * ## ليه دفعة واحدة
 * قايمة الطلبات فيها ١٠٠ صف. لو كل صف سأل لوحده بقى ٢٠٠ استعلام
 * على فتحة الصفحة — والصفحة اللي التاجر بيفتحها عشرات المرات في
 * اليوم مش مكانها ده.
 */
export async function loadTrustScores(
  storeId: string,
  phones: Array<string | null>,
): Promise<Map<string, TrustScore>> {
  const list = [...new Set(phones.filter((p): p is string => Boolean(p && p.trim())))]
  const out = new Map<string, TrustScore>()
  if (list.length === 0) return out

  const [mine, network] = await Promise.all([
    /* سجل الرقم في متجر التاجر نفسه */
    db
      .select({
        phone: orders.customerPhone,
        delivered: DELIVERED_SQL,
        refused: REFUSED_SQL,
      })
      .from(orders)
      .where(
        and(
          eq(orders.storeId, storeId),
          eq(orders.isIncomplete, false),
          inArray(orders.customerPhone, list),
        ),
      )
      .groupBy(orders.customerPhone),

    /*
      سجل الرقم في باقي المتاجر — **أرقام مجمّعة بس**.

      `ne(storeId)` عشان ما نحسبش متجره مرتين. و`count(distinct)`
      بيقول «في كام متجر» من غير ما يقول مين — الفرق ده هو كل
      الفرق بين إشارة خطر وتسريب بيانات.
    */
    db
      .select({
        phone: orders.customerPhone,
        delivered: DELIVERED_SQL,
        refused: REFUSED_SQL,
        stores: sql<number>`count(distinct ${orders.storeId})`,
      })
      .from(orders)
      .where(
        and(
          ne(orders.storeId, storeId),
          eq(orders.isIncomplete, false),
          inArray(orders.customerPhone, list),
        ),
      )
      .groupBy(orders.customerPhone),
  ])

  const netByPhone = new Map(network.map((r) => [r.phone ?? '', r]))

  for (const phone of list) {
    const own = mine.find((m) => m.phone === phone)
    const net = netByPhone.get(phone)

    out.set(
      phone,
      compute({
        delivered: Number(own?.delivered ?? 0),
        refused: Number(own?.refused ?? 0),
        network: {
          delivered: Number(net?.delivered ?? 0),
          refused: Number(net?.refused ?? 0),
          stores: Number(net?.stores ?? 0),
        },
      }),
    )
  }

  return out
}

/** درجة رقم واحد — لصفحة الطلب */
export async function loadTrustScore(storeId: string, phone: string | null): Promise<TrustScore> {
  if (!phone) return EMPTY
  const map = await loadTrustScores(storeId, [phone])
  return map.get(phone) ?? EMPTY
}

/**
 * الحساب.
 *
 * ## ليه الرفض بيوزن أتقل من الاستلام
 * الاستلام هو الأصل المتوقّع، والرفض هو الاستثناء اللي بيكلّف. عميل
 * استلم ٩ ورفض ١ مش زي عميل استلم ٩ بس — الأول كلّف التاجر شحنة
 * ضايعة. الوزن ٣:١ بيخلّي أول رفض يبان من غير ما يحرق عميل كويس.
 *
 * ## والشبكة بنص الوزن
 * سجل الرقم عندنا أهم من سجله عند غيرنا: التاجر ده يعرف عملاءه،
 * وممكن يكون في ظروف تخصّ متجر تاني ما نعرفهاش. فبتتحسب إشارة
 * مساعدة لا حكمًا.
 */
function compute(input: {
  delivered: number
  refused: number
  network: { delivered: number; refused: number; stores: number }
}): TrustScore {
  const { delivered, refused, network } = input

  const totalOwn = delivered + refused
  const totalNet = network.delivered + network.refused
  const reasons: string[] = []

  /* عميل جديد تمامًا — مفيش عليه حكم، والصمت أصدق من درجة مخترعة */
  if (totalOwn === 0 && totalNet === 0) {
    return { ...EMPTY, network }
  }

  const weighted = delivered + network.delivered * 0.5
  const weightedRefused = (refused + network.refused * 0.5) * 3
  const denominator = weighted + weightedRefused

  const score = denominator === 0 ? 100 : Math.round((weighted / denominator) * 100)

  if (delivered > 0) reasons.push(`استلم ${delivered} طلب من متجرك`)
  if (refused > 0) reasons.push(`رفض أو رجّع ${refused} من متجرك`)
  if (network.refused > 0) {
    reasons.push(
      `رفض ${network.refused} طلب في ${network.stores} ${network.stores === 1 ? 'متجر تاني' : 'متاجر تانية'} على المنصة`,
    )
  } else if (network.delivered > 0) {
    reasons.push(`استلم ${network.delivered} طلب في متاجر تانية`)
  }

  /*
    العميل اللي عنده رفض واحد بس ومعاه استلامات كتير مايستاهلش
    تحذير أحمر. الحدود دي بتخلّي الأحمر نادرًا — وعشان كده بيتقرا
    لما يظهر بدل ما التاجر يتعوّد يتخطّاه.
  */
  let level: TrustLevel = score >= 75 ? 'good' : score >= 45 ? 'watch' : 'risky'

  /*
    عيّنة صغيرة ما تكفيش لحكم قاسي.

    عميل طلب مرتين ورفض واحدة نسبته ٥٠٪ — رقم مخيف على الورق،
    وممكن يكون صدفة بحتة (مكانش في البيت، أو الشحنة اتأخرت).
    الوسم الأحمر على حالة زي دي بيحرق عميل كويس، والتاجر لما
    يكتشف إنه غلط مرة أو مرتين بيبطّل ياخد الدرجة بجد خالص.

    أقل من تلات طلبات: أقصى تحذير «حاسب» — الرقم ظاهر قدامه
    وهو يحكم، من غير ما ندّعي يقين مش عندنا.
  */
  const sample = totalOwn + totalNet
  if (sample < 3 && level === 'risky') level = 'watch'
  if (sample < 3) reasons.push('عيّنة صغيرة — ' + sample + (sample === 1 ? ' طلب بس' : ' طلبات بس'))

  return { score, level, delivered, refused, network, reasons }
}

export const TRUST_META: Record<TrustLevel, { label: string; bg: string; fg: string }> = {
  new: { label: 'عميل جديد', bg: 'var(--surface-2)', fg: 'var(--fg-muted)' },
  good: { label: 'موثوق', bg: 'var(--color-success-soft)', fg: 'var(--color-success)' },
  watch: { label: 'حاسب', bg: 'var(--color-warning-soft)', fg: 'var(--color-warning)' },
  risky: { label: 'خطر — أكّد قبل الشحن', bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' },
}
