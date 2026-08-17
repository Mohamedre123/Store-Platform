/**
 * المحافظات والمناطق.
 *
 * مكتوبة في الكود لا في قاعدة البيانات: قايمة ثابتة نادرًا ما تتغيّر،
 * وأي متجر جديد بيلاقيها جاهزة من غير ما يكتب ٢٧ محافظة بإيده.
 * التاجر بيحدّد سعر الشحن لكل واحدة، والقايمة نفسها ما بيلمسهاش.
 */

export type Region = { code: string; name: string; nameEn: string }

export const EGYPT_GOVERNORATES: Region[] = [
  { code: 'CAI', name: 'القاهرة', nameEn: 'Cairo' },
  { code: 'GZ', name: 'الجيزة', nameEn: 'Giza' },
  { code: 'ALX', name: 'الإسكندرية', nameEn: 'Alexandria' },
  { code: 'QH', name: 'القليوبية', nameEn: 'Qalyubia' },
  { code: 'DK', name: 'الدقهلية', nameEn: 'Dakahlia' },
  { code: 'SHR', name: 'الشرقية', nameEn: 'Sharqia' },
  { code: 'GH', name: 'الغربية', nameEn: 'Gharbia' },
  { code: 'MNF', name: 'المنوفية', nameEn: 'Monufia' },
  { code: 'BH', name: 'البحيرة', nameEn: 'Beheira' },
  { code: 'KFS', name: 'كفر الشيخ', nameEn: 'Kafr El Sheikh' },
  { code: 'DT', name: 'دمياط', nameEn: 'Damietta' },
  { code: 'PTS', name: 'بورسعيد', nameEn: 'Port Said' },
  { code: 'IS', name: 'الإسماعيلية', nameEn: 'Ismailia' },
  { code: 'SUZ', name: 'السويس', nameEn: 'Suez' },
  { code: 'FYM', name: 'الفيوم', nameEn: 'Faiyum' },
  { code: 'BNS', name: 'بني سويف', nameEn: 'Beni Suef' },
  { code: 'MN', name: 'المنيا', nameEn: 'Minya' },
  { code: 'AST', name: 'أسيوط', nameEn: 'Asyut' },
  { code: 'SHG', name: 'سوهاج', nameEn: 'Sohag' },
  { code: 'QNA', name: 'قنا', nameEn: 'Qena' },
  { code: 'LX', name: 'الأقصر', nameEn: 'Luxor' },
  { code: 'ASN', name: 'أسوان', nameEn: 'Aswan' },
  { code: 'BA', name: 'البحر الأحمر', nameEn: 'Red Sea' },
  { code: 'WAD', name: 'الوادي الجديد', nameEn: 'New Valley' },
  { code: 'MT', name: 'مطروح', nameEn: 'Matrouh' },
  { code: 'SIN', name: 'شمال سيناء', nameEn: 'North Sinai' },
  { code: 'JS', name: 'جنوب سيناء', nameEn: 'South Sinai' },
]

const BY_COUNTRY: Record<string, Region[]> = {
  EG: EGYPT_GOVERNORATES,
  SA: [
    { code: 'RUH', name: 'الرياض', nameEn: 'Riyadh' },
    { code: 'JED', name: 'جدة', nameEn: 'Jeddah' },
    { code: 'DMM', name: 'الدمام', nameEn: 'Dammam' },
    { code: 'MKK', name: 'مكة المكرمة', nameEn: 'Makkah' },
    { code: 'MED', name: 'المدينة المنورة', nameEn: 'Madinah' },
  ],
  AE: [
    { code: 'DXB', name: 'دبي', nameEn: 'Dubai' },
    { code: 'AUH', name: 'أبوظبي', nameEn: 'Abu Dhabi' },
    { code: 'SHJ', name: 'الشارقة', nameEn: 'Sharjah' },
  ],
}

export function regionsFor(country: string): Region[] {
  return BY_COUNTRY[country.toUpperCase()] ?? EGYPT_GOVERNORATES
}

export const COUNTRIES: Array<{ code: string; name: string; dial: string }> = [
  { code: 'EG', name: 'مصر', dial: '20' },
  { code: 'SA', name: 'السعودية', dial: '966' },
  { code: 'AE', name: 'الإمارات', dial: '971' },
  { code: 'KW', name: 'الكويت', dial: '965' },
  { code: 'QA', name: 'قطر', dial: '974' },
  { code: 'BH', name: 'البحرين', dial: '973' },
  { code: 'OM', name: 'عُمان', dial: '968' },
  { code: 'JO', name: 'الأردن', dial: '962' },
]
