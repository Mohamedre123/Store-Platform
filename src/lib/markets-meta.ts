/**
 * تحويل الأسعار بين الأسواق — للجهتين.
 *
 * ملف مستقل عن `markets.ts` لأن ده `server-only`: المتجر بيعرض
 * الأسعار محوَّلة في مكوّنات بتترسم على المتصفح كمان، والحساب
 * لازم يبقى **نفس الحساب بالحرف** في الجهتين. لو المتصفح قرّب
 * بطريقة والخادم بطريقة، العميل بيشوف ٣٩ وبيتحاسب ٣٩.٩٩.
 */

export type RoundingMode = 'none' | 'nearest' | 'charm'

export const ROUNDING_MODES: Array<{ key: RoundingMode; label: string; hint: string }> = [
  { key: 'none', label: 'زي ما هو', hint: 'الرقم الناتج من التحويل بالظبط — ٣٨.٤٢' },
  { key: 'nearest', label: 'لأقرب صحيح', hint: 'من غير كسور — ٣٨' },
  { key: 'charm', label: 'ينتهي بـ٩٩', hint: 'شكل السعر اللي بيبيع — ٣٨.٩٩' },
]

export type MarketRow = {
  id: string
  name: string
  country: string
  currency: string
  rateMicros: number
  rounding: RoundingMode
  isDefault: boolean
  isActive: boolean
}

/** المليون — سعر التحويل مخزَّن مضروبًا فيه */
export const RATE_SCALE = 1_000_000

/**
 * تحويل مبلغ من عملة المتجر لعملة السوق.
 *
 * ## الحساب بالأعداد الصحيحة لآخر خطوة
 * `Math.round(minor * rate / SCALE)` بيفضل صحيحًا لأي مبلغ في
 * السوق ده. الضرب قبل القسمة مقصود: القسمة الأول بتدّي كسرًا
 * عشريًّا والباقي بيتراكم على الطلب الكبير.
 *
 * ## والتقريب بعد التحويل لا قبله
 * ٤٩٩ جنيه × ٠.٠٧٧ = ٣٨.٤٢ ريال. التقريب على الجنيه الأول كان
 * هيدّي رقمًا مختلفًا، والفرق بيبان لما التاجر يقارن.
 */
export function convertPrice(
  minorUnits: number,
  rateMicros: number,
  rounding: RoundingMode = 'nearest',
): number {
  if (!Number.isFinite(minorUnits) || minorUnits <= 0) return 0
  const raw = Math.round((minorUnits * rateMicros) / RATE_SCALE)

  if (rounding === 'none') return raw

  if (rounding === 'nearest') {
    /* لأقرب وحدة كاملة — يعني لأقرب مية في الوحدة الصغرى */
    return Math.max(100, Math.round(raw / 100) * 100)
  }

  /*
    ينتهي بـ٩٩ — و**مش بينزل تحت السعر المحوَّل أبدًا**.

    ٣٨.٤٢ بتبقى ٣٨.٩٩ لا ٣٧.٩٩. الفرق ده كان غلطة فلوس حقيقية:
    الصيغة الأولى كانت `units * 100 - 1` اللي بترجّع كسر الوحدة
    **اللي قبلها**، يعني كل منتج بيتباع أرخص من سعره المحوَّل —
    والفرق بيطلع من جيب التاجر في كل بيعة.

    الاختبار هو اللي مسكها: ٤٩٩ جنيه بسعر ٠.٠٧٧ طلعت ٣٧.٩٩ وهي
    المفروض ٣٨.٤٢ على الأقل.

    و٠.٩٩ هي الحد الأدنى — السوق اللي سعر تحويله ضعيف جدًا ما
    يطلّعش سعرًا صفرًا.
  */
  const units = Math.max(0, Math.floor(raw / 100))
  return units === 0 ? 99 : units * 100 + 99
}

/** السوق الافتراضي أو أول واحد شغّال — الترتيب ده هو اللي بيحسم */
export function pickMarket(markets: MarketRow[], country: string | null): MarketRow | null {
  const active = markets.filter((m) => m.isActive)
  if (active.length === 0) return null

  if (country) {
    const exact = active.find((m) => m.country.toUpperCase() === country.toUpperCase())
    if (exact) return exact
  }

  return active.find((m) => m.isDefault) ?? active[0]
}

/** أعلام الدول — للمبدّل في هيدر المتجر */
export function countryFlag(code: string): string {
  const c = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(c)) return '🏳️'
  return String.fromCodePoint(...[...c].map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65))
}

/** البلاد اللي التاجر المصري بيبيع لها فعلًا — والباقي بيتكتب بإيده */
export const COMMON_MARKETS: Array<{ country: string; name: string; currency: string }> = [
  { country: 'EG', name: 'مصر', currency: 'EGP' },
  { country: 'SA', name: 'السعودية', currency: 'SAR' },
  { country: 'AE', name: 'الإمارات', currency: 'AED' },
  { country: 'KW', name: 'الكويت', currency: 'KWD' },
  { country: 'QA', name: 'قطر', currency: 'QAR' },
  { country: 'BH', name: 'البحرين', currency: 'BHD' },
  { country: 'OM', name: 'عُمان', currency: 'OMR' },
  { country: 'JO', name: 'الأردن', currency: 'JOD' },
  { country: 'LY', name: 'ليبيا', currency: 'LYD' },
  { country: 'SD', name: 'السودان', currency: 'SDG' },
]
