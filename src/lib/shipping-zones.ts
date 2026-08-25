/**
 * مناطق التسعير — الطبقة اللي بين شركة الشحن والمحافظات.
 *
 * ## المشكلة اللي بتحلّها
 * التاجر بيفتح صفحة الشحن فيلاقي ٢٧ خانة فاضية. وهو مالوش ٢٧ سعر —
 * شركة الشحن بتدّيه **كارت أسعار بالمناطق**: القاهرة الكبرى بكذا،
 * الدلتا بكذا، الصعيد بكذا. فهو بيقعد يترجم الكارت ده لـ٢٧ خانة
 * بإيده، وبيغلط، وبينسى محافظة فتتسعّر بالسعر الافتراضي الغلط.
 *
 * المناطق دي هي نفس التقسيم اللي **كل** شركات الشحن المصرية بتسعّر
 * بيه فعلًا — مش تقسيم اخترعناه. التاجر بيكتب خمس أرقام، والـ٢٧
 * محافظة بتتملي لوحدها.
 *
 * ## ليه مش في قاعدة البيانات
 * جغرافيا. المحافظة مش بتنتقل من الدلتا للصعيد. ولو شركة سعّرت
 * محافظة بره منطقتها، التاجر بيعدّل خانتها بإيده بعد الملء — الملء
 * نقطة بداية مش قفل.
 */

export type ZoneKey =
  | 'greater_cairo'
  | 'alexandria'
  | 'delta'
  | 'canal'
  | 'upper_egypt'
  | 'remote'
  | 'main'
  | 'other'

export type ShippingZoneDef = {
  key: ZoneKey
  label: string
  /** وصف قصير — التاجر لازم يعرف المنطقة دي فيها إيه قبل ما يسعّرها */
  hint: string
  /** أسماء المحافظات زي ما هي مكتوبة في `regions.ts` بالحرف */
  cities: string[]
}

/**
 * مصر — ست مناطق.
 *
 * التقسيم ده متطابق مع كروت أسعار بوسطة ومايلرز وJ&T: القاهرة
 * الكبرى وحدة واحدة (القاهرة والجيزة والقليوبية متصلين عمرانيًا)،
 * والإسكندرية لوحدها لأن كل الشركات ليها مركز فرز فيها، والنائية
 * لوحدها لأن سعرها بيبقى الضعف أو أكتر.
 */
const EGYPT_ZONES: ShippingZoneDef[] = [
  {
    key: 'greater_cairo',
    label: 'القاهرة الكبرى',
    hint: 'القاهرة والجيزة والقليوبية',
    cities: ['القاهرة', 'الجيزة', 'القليوبية'],
  },
  {
    key: 'alexandria',
    label: 'الإسكندرية',
    hint: 'الإسكندرية لوحدها — كل الشركات ليها فرز فيها',
    cities: ['الإسكندرية'],
  },
  {
    key: 'delta',
    label: 'الدلتا',
    hint: 'الدقهلية والشرقية والغربية والمنوفية والبحيرة وكفر الشيخ ودمياط',
    cities: ['الدقهلية', 'الشرقية', 'الغربية', 'المنوفية', 'البحيرة', 'كفر الشيخ', 'دمياط'],
  },
  {
    key: 'canal',
    label: 'القناة',
    hint: 'بورسعيد والإسماعيلية والسويس',
    cities: ['بورسعيد', 'الإسماعيلية', 'السويس'],
  },
  {
    key: 'upper_egypt',
    label: 'الصعيد',
    hint: 'من الفيوم لأسوان',
    cities: ['الفيوم', 'بني سويف', 'المنيا', 'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان'],
  },
  {
    key: 'remote',
    label: 'المناطق النائية',
    hint: 'البحر الأحمر والوادي الجديد ومطروح وسيناء — سعرها عادةً الضعف',
    cities: ['البحر الأحمر', 'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء'],
  },
]

const SAUDI_ZONES: ShippingZoneDef[] = [
  {
    key: 'main',
    label: 'المدن الرئيسية',
    hint: 'الرياض وجدة والدمام',
    cities: ['الرياض', 'جدة', 'الدمام'],
  },
  {
    key: 'other',
    label: 'باقي المدن',
    hint: 'مكة المكرمة والمدينة المنورة',
    cities: ['مكة المكرمة', 'المدينة المنورة'],
  },
]

const UAE_ZONES: ShippingZoneDef[] = [
  { key: 'main', label: 'دبي والشارقة', hint: 'المنطقة الشمالية', cities: ['دبي', 'الشارقة'] },
  { key: 'other', label: 'أبوظبي', hint: 'الإمارة الغربية', cities: ['أبوظبي'] },
]

const BY_COUNTRY: Record<string, ShippingZoneDef[]> = {
  EG: EGYPT_ZONES,
  SA: SAUDI_ZONES,
  AE: UAE_ZONES,
}

export function zonesFor(country: string): ShippingZoneDef[] {
  return BY_COUNTRY[country.toUpperCase()] ?? EGYPT_ZONES
}

/** المحافظة → مفتاح منطقتها، للبحث العكسي */
export function zoneOfCity(country: string, city: string): ZoneKey | null {
  const name = city.trim()
  return zonesFor(country).find((z) => z.cities.includes(name))?.key ?? null
}

/**
 * بيفرد أسعار المناطق على المحافظات.
 *
 * المنطقة اللي التاجر ساب سعرها فاضي بتترمي بالكامل — ما بتترجمش
 * لصفر. صفر معناه «الشحن مجاني للمحافظات دي» وده غير اللي قصده،
 * والفرق ده فلوس بتضيع من جيبه على كل طلب.
 */
export function spreadZonePrices(
  country: string,
  prices: Partial<Record<ZoneKey, string>>,
): Array<{ city: string; price: string }> {
  const out: Array<{ city: string; price: string }> = []

  for (const zone of zonesFor(country)) {
    const price = prices[zone.key]?.trim()
    if (!price) continue
    for (const city of zone.cities) out.push({ city, price })
  }

  return out
}
