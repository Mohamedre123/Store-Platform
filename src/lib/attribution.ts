/**
 * من فين جه العميل.
 *
 * ## المشكلة اللي بيحلّها
 * عمودَي `utm` على `orders` و`store_events` كانوا موجودين في المخطط
 * من أول يوم و**محدّش بيكتب فيهم**. يعني التاجر اللي بيصرف على
 * إعلانات فيسبوك وتيك توك مع بعض ما عندوش أي طريق يعرف بيه أنهي
 * واحد جاب الطلب — بيقارن كشف البوابة بكشف المنصة بإيده، أو ما
 * بيقارنش خالص.
 *
 * ## الالتقاط في الوكيل لا في الصفحة
 * العميل بيوصل من الإعلان على صفحة منتج، وبيلفّ في المتجر، وبيطلب
 * بعد عشر دقايق من صفحة تانية خالص. لو قرينا الرابط وقت الطلب،
 * الوسوم بتكون راحت من زمان. الكوكي بتخلّي أول زيارة هي اللي
 * بتتحسب — وهي الصح: الإعلان ده هو اللي جابه.
 *
 * ## أول لمسة بتغلب آخر لمسة
 * العميل اللي جه من إعلان وبعدين رجع من بحث جوجل باسم المتجر —
 * الإعلان هو اللي عرّفه بالمتجر، والبحث مجرد طريق رجوع. لو كتبنا
 * فوق القديم، كل إعلان ناجح بينسب نجاحه لجوجل.
 *
 * الملف ده **مش** `server-only`: الوكيل بيشغّله على حافة الشبكة،
 * والقراءة بتحصل في أفعال الخادم. مفيش فيه أي قراءة من قاعدة
 * البيانات — تحويل نصوص وبس.
 */

export const ATTRIBUTION_COOKIE = 'zw_utm'

export type Attribution = {
  /** فيسبوك · تيك توك · جوجل · انستجرام · مباشر … */
  source?: string
  medium?: string
  campaign?: string
  content?: string
  term?: string
}

/**
 * المضيف → اسم المصدر اللي التاجر بيعرفه.
 *
 * التاجر ما بيعرفش `l.facebook.com` ولا `lm.instagram.com` — بيعرف
 * «فيسبوك» و«إنستجرام». والتقرير اللي بيسمّي نفس المصدر بتلات صور
 * بيقسّم رقمه على تلاتة ويخلّي القرار غلط.
 */
const HOST_SOURCES: Array<[RegExp, string]> = [
  [/(^|\.)facebook\.com$|(^|\.)fb\.(com|me)$|^l\.facebook/, 'facebook'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)google\./, 'google'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'youtube'],
  [/(^|\.)snapchat\.com$/, 'snapchat'],
  [/(^|\.)x\.com$|(^|\.)twitter\.com$/, 'twitter'],
  [/(^|\.)wa\.me$|(^|\.)whatsapp\.com$/, 'whatsapp'],
  [/(^|\.)t\.me$|(^|\.)telegram\./, 'telegram'],
  [/(^|\.)bing\.com$/, 'bing'],
  [/(^|\.)linkedin\.com$/, 'linkedin'],
  [/(^|\.)pinterest\./, 'pinterest'],
]

/**
 * معرّف النقرة → المنصة.
 *
 * الإعلان اللي التاجر ما ظبّطش عليه وسوم UTM بيوصل بلا `utm_source`
 * لكن بمعرّف نقرة المنصة بتحطّه لوحدها. من غير القراءة دي، أغلب
 * إعلانات التجّار بتتحسب «مباشر» — وهو أسوأ رقم في التقرير لأنه
 * بيبان كأن الإعلانات مش شغّالة.
 */
const CLICK_IDS: Array<[string, string]> = [
  ['fbclid', 'facebook'],
  ['ttclid', 'tiktok'],
  ['gclid', 'google'],
  ['gbraid', 'google'],
  ['wbraid', 'google'],
  ['msclkid', 'bing'],
  ['sccid', 'snapchat'],
  ['twclid', 'twitter'],
]

const clean = (v: string | null | undefined) =>
  v?.trim().slice(0, 80).toLowerCase() || undefined

/** يطلّع المصدر من مضيف المُحيل */
export function sourceFromReferrer(referrer: string | null | undefined): string | undefined {
  if (!referrer) return undefined
  let host: string
  try {
    host = new URL(referrer).hostname.toLowerCase()
  } catch {
    return undefined
  }
  for (const [pattern, name] of HOST_SOURCES) {
    if (pattern.test(host)) return name
  }
  /* مضيف مش في القايمة بيتسجّل زي ما هو — أحسن من «غير معروف» */
  return host.replace(/^www\./, '').slice(0, 80)
}

/**
 * يقرا الإسناد من رابط الزيارة والمُحيل.
 *
 * بيرجّع `null` لو مفيش أي إشارة — والفرق مهم: `null` معناها «ما
 * تكتبش حاجة»، فالتنقّل الداخلي ما بيدهسش إسناد الزيارة الأولى.
 */
export function readAttribution(
  params: URLSearchParams,
  referrer?: string | null,
  selfHost?: string | null,
): Attribution | null {
  const source = clean(params.get('utm_source'))
  const medium = clean(params.get('utm_medium'))
  const campaign = clean(params.get('utm_campaign'))
  const content = clean(params.get('utm_content'))
  const term = clean(params.get('utm_term'))

  if (source || medium || campaign) {
    return { source, medium, campaign, content, term }
  }

  /* إعلان بلا وسوم — معرّف النقرة بيقول المنصة */
  for (const [key, platform] of CLICK_IDS) {
    if (params.get(key)) return { source: platform, medium: 'paid' }
  }

  /*
    المُحيل — بس لو من برّه المتجر.

    التنقّل جوّه المتجر بيبعت المُحيل كمان. لو حسبناه، أول ضغطة على
    «كل المنتجات» بتسجّل المتجر كمصدر لنفسه وتدهس الإعلان اللي جابه.
  */
  const fromReferrer = sourceFromReferrer(referrer)
  if (fromReferrer && !isSelf(fromReferrer, selfHost)) {
    return { source: fromReferrer, medium: 'referral' }
  }

  return null
}

/**
 * المُحيل ده المتجر نفسه؟
 *
 * ## المقارنة بالمضيف بلا منفذ
 * ترويسة `host` بتشيل المنفذ (`localhost:3000`)، ومضيف المُحيل لأ
 * (`localhost`). المقارنة النصية المباشرة كانت بتفشل — واتأكدنا من
 * ده عمليًا: التنقّل الداخلي كان بيتسجّل مصدرًا اسمه «localhost».
 *
 * ## واللاحقة لا التطابق
 * المتجر ممكن يكون على نطاق فرعي (`matgar.zawya.app`) والزيارة جاية
 * من الجذر (`zawya.app`) أو العكس. اللاحقة بتغطّي الاتنين، و`www`
 * بتتشال من الطرفين عشان `www.x.com` و`x.com` نفس المكان.
 */
function isSelf(referrerHost: string, selfHost: string | null | undefined): boolean {
  if (!selfHost) return false
  const bare = (h: string) => h.split(':')[0].toLowerCase().replace(/^www\./, '')
  const a = bare(referrerHost)
  const b = bare(selfHost)
  if (!a || !b) return false
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`)
}

/**
 * يفكّ الكوكي — بيرجّع `null` لأي قيمة تالفة بدل ما يرمي.
 *
 * **الترميز مزدوج عن قصد ومتحقَّق منه.** `serializeAttribution` بتعمل
 * `encodeURIComponent`، وNext بيعمل واحدة تانية وهو بيكتب الكوكي —
 * والقراءة بتفكّ الاتنين بنفس الترتيب المعكوس: `cookies().get()`
 * بيفكّ واحدة، والسطر اللي تحت بيفكّ التانية. اتأكدنا من الدورة دي
 * على القيم اللي اتكتبت فعلًا في `store_events.utm`.
 *
 * متشيلش الترميز من هنا من غير ما تشيله من الكتابة — لأن الكوكيز
 * اللي اتكتبت عند العملاء دلوقتي مترمّزة مرتين، وقراءتها مرة واحدة
 * بتطلّع `%7B…` مش JSON، ويبوظ إسناد كل زائر حالي.
 */
export function parseAttribution(raw: string | null | undefined): Attribution | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Attribution
    if (parsed && typeof parsed === 'object') return parsed
  } catch {
    /* كوكي قديمة أو متلاعب فيها — بنتجاهلها بهدوء */
  }
  return null
}

export function serializeAttribution(a: Attribution): string {
  return encodeURIComponent(JSON.stringify(a))
}

/** اسم المصدر بالعربي — للتقارير */
export const SOURCE_LABELS: Record<string, string> = {
  facebook: 'فيسبوك',
  instagram: 'إنستجرام',
  tiktok: 'تيك توك',
  google: 'جوجل',
  youtube: 'يوتيوب',
  snapchat: 'سناب شات',
  twitter: 'إكس',
  whatsapp: 'واتساب',
  telegram: 'تيليجرام',
  bing: 'بينج',
  linkedin: 'لينكدإن',
  pinterest: 'بينتريست',
  direct: 'مباشر',
}

export function sourceLabel(source: string | null | undefined): string {
  if (!source) return SOURCE_LABELS.direct
  return SOURCE_LABELS[source] ?? source
}

/** اسم الوسيط بالعربي — «paid» مش كلمة التاجر بيقولها */
export const MEDIUM_LABELS: Record<string, string> = {
  paid: 'إعلان مدفوع',
  cpc: 'إعلان مدفوع',
  referral: 'إحالة',
  organic: 'بحث طبيعي',
  social: 'سوشيال',
  email: 'بريد',
  whatsapp: 'واتساب',
}

export function mediumLabel(medium: string | null | undefined): string | null {
  if (!medium) return null
  return MEDIUM_LABELS[medium] ?? medium
}
