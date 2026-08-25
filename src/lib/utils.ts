import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * كل المبالغ مخزَّنة بالوحدة الصغرى (قرش). هذه الدالة هي الطريق
 * الوحيد لعرضها — لا تُنسَّق الأرقام يدويًا في أي مكان آخر.
 */
export function formatMoney(
  minorUnits: number,
  currency = 'EGP',
  locale = 'ar-EG',
  options: { withSymbol?: boolean; decimals?: boolean } = {},
) {
  const { withSymbol = true, decimals = true } = options
  const value = minorUnits / 100

  try {
    return new Intl.NumberFormat(locale, {
      style: withSymbol ? 'currency' : 'decimal',
      currency,
      minimumFractionDigits: decimals && value % 1 !== 0 ? 2 : 0,
      maximumFractionDigits: decimals ? 2 : 0,
    }).format(value)
  } catch {
    // احتياطي لو المتصفح ما يعرفش العملة أو اللغة
    return `${value.toFixed(decimals ? 2 : 0)} ${withSymbol ? currency : ''}`.trim()
  }
}

/** يحوّل مبلغًا كتبه المستخدم (490.5) إلى وحدات صغرى (49050) */
export function toMinorUnits(input: string | number): number {
  const n = typeof input === 'number' ? input : Number(String(input).replace(/[^\d.-]/g, ''))
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

export function fromMinorUnits(minorUnits: number): number {
  return Math.round(minorUnits) / 100
}

/** نقاط الأساس → نسبة مئوية للعرض (1400 → "14%") */
export function formatBps(bps: number, locale = 'ar-EG') {
  const pct = bps / 100
  try {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(pct) + '%'
  } catch {
    return `${pct}%`
  }
}

export function applyBps(amount: number, bps: number): number {
  return Math.round((amount * bps) / 10000)
}

/**
 * خريطة نقحرة عربي → لاتيني.
 * النطق مصري متعمَّد: الجيم «g» لا «j»، عشان التاجر يقرأ رابطه
 * ويلاقيه مطابقًا للي بينطقه.
 */
const TRANSLITERATION: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'e', آ: 'a', ٱ: 'a',
  ب: 'b', ت: 't', ث: 'th', ج: 'g', ح: 'h', خ: 'kh',
  د: 'd', ذ: 'z', ر: 'r', ز: 'z', س: 's', ش: 'sh',
  ص: 's', ض: 'd', ط: 't', ظ: 'z', ع: 'a', غ: 'gh',
  ف: 'f', ق: 'q', ك: 'k', ل: 'l', م: 'm', ن: 'n',
  ه: 'h', ة: 'a', و: 'w', ؤ: 'o', ي: 'y', ى: 'a', ئ: 'e',
  ء: '', پ: 'p', چ: 'ch', ڤ: 'v', گ: 'g',
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
}

/** التشكيل والتطويل — يُحذفان قبل النقحرة */
const ARABIC_MARKS = /[ً-ْٰـ]/g

/**
 * يحوّل اسمًا عربيًا إلى رابط لاتيني مقروء.
 * «متجر الأناقة» → «mtgr-alanaqa»
 *
 * لازمة لأن أغلب التجار هيكتبوا اسم متجرهم بالعربي، والنطاق الفرعي
 * لا يقبل إلا حروفًا لاتينية.
 */
export function transliterate(input: string): string {
  const cleaned = input.replace(ARABIC_MARKS, '')
  let out = ''
  for (const char of cleaned) {
    out += TRANSLITERATION[char] ?? char
  }
  return out
}

/** اقتراح نطاق فرعي صالح من اسم المتجر، عربيًا كان أو إنجليزيًا */
export function suggestStoreSlug(name: string): string {
  return transliterate(name)
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
    .replace(/-$/, '')
}

/**
 * يحوّل نصًا عربيًا أو إنجليزيًا إلى slug صالح للروابط.
 * العربية تُبقى كما هي (URL-encoded) لأن جوجل يفهمها ويفضّلها للسيو المحلي.
 */
export function slugify(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80)
}

/** توحيد أرقام الهواتف المصرية: 01012345678 → +201012345678 */
export function normalizePhone(input: string, countryCode = '20'): string {
  let digits = input.replace(/[^\d+]/g, '')
  // تحويل الأرقام العربية الهندية
  digits = digits.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
  if (digits.startsWith('+')) return digits
  if (digits.startsWith('00')) return `+${digits.slice(2)}`
  if (digits.startsWith('0')) return `+${countryCode}${digits.slice(1)}`
  if (digits.startsWith(countryCode)) return `+${digits}`
  return `+${countryCode}${digits}`
}

export function isValidPhone(input: string): boolean {
  const normalized = normalizePhone(input)
  return /^\+\d{10,15}$/.test(normalized)
}

/**
 * فحص بريد بسيط عن قصد.
 *
 * الفحوص الصارمة بترفض عناوين شرعية (نقط، علامات زائد، نطاقات
 * جديدة)، والعميل بيقف قدام رسالة «بريد غلط» وهو كاتبه صح. اللي
 * محتاجينه هنا نمنع الغلط الواضح بس — التسليم الحقيقي هو اللي
 * بيحكم في الآخر.
 */
export function isValidEmail(input: string): boolean {
  const v = input.trim()
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v) && v.length <= 254
}

export function formatDate(date: Date | string, locale = 'ar-EG') {
  const d = typeof date === 'string' ? new Date(date) : date
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(d)
  } catch {
    return d.toISOString().slice(0, 10)
  }
}

export function formatDateTime(date: Date | string, locale = 'ar-EG') {
  const d = typeof date === 'string' ? new Date(date) : date
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  } catch {
    return d.toISOString()
  }
}

/**
 * فكّ ترميز جزء من الرابط جاي من `params`.
 *
 * **مش زيادة احتياط — ده بيصلّح ٤٠٤ حقيقي.** في مسار ديناميكي واحد،
 * `generateMetadata` بتاخد القيمة مفكوكة والصفحة بتاخدها مشفّرة
 * (‎%D8%B9…‎). أي رابط فيه حروف عربية بيقع، والتاجر اللي سمّى صفحة
 * هبوطه بالعربي بيلاقي رابطه ميّت.
 *
 * `decodeURIComponent` على نص مفكوك أصلًا ما بيغيّرش حاجة، وبيرمي بس
 * لو النص فيه ‎%‎ مش جزء من ترميز صحيح — وساعتها بنرجّعه زي ما هو.
 */
export function decodeSlug(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}
