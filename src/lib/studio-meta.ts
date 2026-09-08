/**
 * مقاسات المنصات وأنواع المحتوى — **للجهتين**.
 *
 * ملف مستقل عن `studio.ts` لأن ده `server-only`: شاشة الاستوديو
 * مكوّن عميل ومحتاجة نفس القايمة اللي الخادم بيولّد بيها. لو كل
 * جهة كتبت قايمتها، التاجر بيختار مقاسًا والخادم يولّد غيره.
 */

export type PresetKey = 'square' | 'portrait' | 'story' | 'landscape'

export const PRESETS: Array<{
  key: PresetKey
  label: string
  ratio: string
  /** النسبة كنص للوصف — الموديل بيفهم «1:1» أحسن من «مربع» */
  aspect: string
  hint: string
  /** لعرض المعاينة بنفس نسبة الناتج */
  css: string
}> = [
  /*
    الطولي الأول — وده مقاس إنستجرام الحقيقي.

    ٤:٥ بياخد مساحة أطول في التايم لاين من المربّع، يعني بيوقّف
    الإصبع أكتر. والمربّع اتساب لفيسبوك اللي بيعرضه كامل.
  */
  {
    key: 'portrait',
    label: 'إنستجرام',
    ratio: '4:5',
    aspect: '4:5',
    hint: 'المقاس اللي بياخد أكبر مساحة في التايم لاين',
    css: 'aspect-[4/5]',
  },
  {
    key: 'square',
    label: 'مربّع',
    ratio: '1:1',
    aspect: '1:1',
    hint: 'فيسبوك — وبيشتغل في أي مكان',
    css: 'aspect-square',
  },
  {
    key: 'story',
    label: 'ستوري وريلز',
    ratio: '9:16',
    aspect: '9:16',
    hint: 'ستوري إنستجرام وفيسبوك وتيك توك',
    css: 'aspect-[9/16]',
  },
  {
    key: 'landscape',
    label: 'عرضي',
    ratio: '16:9',
    aspect: '16:9',
    hint: 'غلاف وإعلانات',
    css: 'aspect-video',
  },
]

/** الافتراضي أول واحد في القايمة — الطولي */
export function presetOf(key: string) {
  return PRESETS.find((p) => p.key === key) ?? PRESETS[0]
}

/* ══════════════════════════════════════════════════════════════
   نبرة المحتوى
   ══════════════════════════════════════════════════════════════ */

export type ToneKey = 'sell' | 'story' | 'offer' | 'launch' | 'tips'

/**
 * نبرات جاهزة.
 *
 * التاجر اللي بيبص على خانة وصف فاضية بيكتب «اعملي بوست» ويطلع
 * بوست عام. الاختيار الجاهز بيدّي الموديل زاوية، والتاجر يقدر
 * يزوّد عليها بكلامه.
 */
export const TONES: Array<{ key: ToneKey; label: string; hint: string; brief: string }> = [
  {
    key: 'sell',
    label: 'بوست بيعي',
    hint: 'يوصف المنتج ويقفل بدعوة للشرا',
    brief:
      'بوست بيعي مباشر: ابدأ بجملة تشدّ، اذكر أهم فايدتين أو تلاتة للمنتج ' +
      'بلغة العميل مش بلغة الكتالوج، واقفل بدعوة واضحة للطلب.',
  },
  {
    key: 'offer',
    label: 'عرض وخصم',
    hint: 'يركّز على السعر والاستعجال',
    brief:
      'بوست عرض: ركّز على القيمة والسعر، واستخدم استعجالًا صادقًا (كمية محدودة ' +
      'أو مدة العرض) من غير مبالغة ولا وعود كاذبة.',
  },
  {
    key: 'story',
    label: 'حكاية',
    hint: 'يبدأ بمشكلة العميل',
    brief:
      'بوست حكاية: ابدأ بموقف أو مشكلة العميل بيعيشها فعلًا، وخلّي المنتج ' +
      'هو الحل في نص الحكاية لا في أولها.',
  },
  {
    key: 'launch',
    label: 'إطلاق جديد',
    hint: 'يعلن وصول منتج',
    brief:
      'بوست إطلاق: أعلن وصول المنتج بحماس، واذكر إيه اللي بيميّزه عن اللي قبله، ' +
      'وادعُ الناس يجرّبوه أول واحدة.',
  },
  {
    key: 'tips',
    label: 'نصيحة مفيدة',
    hint: 'محتوى بيبني ثقة من غير بيع مباشر',
    brief:
      'بوست نصيحة: اكتب معلومة أو نصيحة حقيقية مفيدة في مجال المتجر، واذكر ' +
      'المنتج في الآخر كإشارة خفيفة لا كإعلان.',
  },
]

export function toneOf(key: string) {
  return TONES.find((t) => t.key === key) ?? TONES[0]
}

/* ══════════════════════════════════════════════════════════════
   المنصات
   ══════════════════════════════════════════════════════════════ */

export type SocialPlatform = 'facebook' | 'instagram' | 'tiktok'

export const PLATFORMS: Array<{
  key: SocialPlatform
  label: string
  color: string
  /** حدّ النص عند المنصة — بيتقصّ قبل الإرسال لا بعد الرفض */
  captionLimit: number
  note: string
}> = [
  {
    key: 'facebook',
    label: 'فيسبوك',
    color: '#1877F2',
    captionLimit: 5000,
    note: 'بينشر على صفحة متجرك — مش على حسابك الشخصي',
  },
  {
    key: 'instagram',
    label: 'إنستجرام',
    color: '#E1306C',
    captionLimit: 2200,
    note: 'محتاج حساب أعمال مربوط بصفحة فيسبوك',
  },
  {
    key: 'tiktok',
    label: 'تيك توك',
    color: '#010101',
    captionLimit: 2200,
    note: 'الصور بتنزل كبوست صور',
  },
]

export function platformOf(key: string) {
  return PLATFORMS.find((p) => p.key === key) ?? PLATFORMS[0]
}

/* ══════════════════════════════════════════════════════════════
   الجدولة
   ══════════════════════════════════════════════════════════════ */

/** أيام الأسبوع — ٠ الأحد، زي `Date.getDay` بالظبط */
export const WEEKDAYS = [
  { day: 0, label: 'الأحد', short: 'ح' },
  { day: 1, label: 'الاتنين', short: 'ن' },
  { day: 2, label: 'التلات', short: 'ث' },
  { day: 3, label: 'الأربع', short: 'ر' },
  { day: 4, label: 'الخميس', short: 'خ' },
  { day: 5, label: 'الجمعة', short: 'ج' },
  { day: 6, label: 'السبت', short: 'س' },
]

/**
 * وصف الجدول بجملة — للتاجر قبل ما يحفظ.
 *
 * «[0,2,4] · 10:00» مالهاش معنى لحد. والجملة بتخلّي الغلطة تبان
 * قبل ما البوست ينزل يوم مش مقصود.
 */
export function describeSchedule(days: number[], time: string): string {
  if (days.length === 0) return 'اختار يوم واحد على الأقل'
  if (days.length === 7) return `كل يوم الساعة ${time}`

  const names = WEEKDAYS.filter((w) => days.includes(w.day)).map((w) => w.label)
  const list = names.length === 1 ? names[0] : names.slice(0, -1).join('، ') + ' و' + names.at(-1)
  return `كل ${list} الساعة ${time}`
}

/**
 * الميعاد الجاي.
 *
 * ## بيتحسب بتوقيت المتجر لا بتوقيت الخادم
 * الخادم في فرانكفورت والتاجر في القاهرة. «الساعة ١٠» عند التاجر
 * هي ٨ عند الخادم صيفًا و٩ شتاءً — والفرق ده بيخلّي البوست ينزل
 * الساعة ١٢ بالليل وهو طالب الصبح.
 *
 * ## والدقيقة الحالية ما بتتحسبش
 * لو الميعاد النهارده ٠٠:١٠ واحنا ٠٠:١٠ بالظبط، بنرجّع الأسبوع
 * الجاي لا دلوقتي — وإلا الجدول اللي لسه اشتغل بيشتغل تاني في نفس
 * الدقيقة.
 */
export function nextRun(
  days: number[],
  time: string,
  timezone: string,
  from: Date = new Date(),
): Date | null {
  if (days.length === 0) return null

  const [hh, mm] = time.split(':').map((n) => Number(n))
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null

  /*
    النهارده الأول — وده الترتيب الصح لا تفصيلة.

    الدوران على الأيام الجاية قبل النهارده كان بيخلّي اللي بيظبّط
    «كل يوم ١١ بالليل» الساعة ٨ الصبح ياخد أول بوست **بكرة** —
    عدّى النهارده وهو لسه ما فاتش. مسكها اختبار الحالة دي بالظبط.
  */
  const today = localParts(from, timezone)
  if (days.includes(today.weekday)) {
    const at = zonedTime(today.year, today.month, today.day, hh, mm, timezone)
    /*
      والمقارنة «أكبر من» لا «أكبر أو يساوي»: الميعاد اللي هو دلوقتي
      بالظبط بيروح للمرة الجاية. من غيرها الجدول اللي لسه اشتغل
      بيشتغل تاني في نفس الدقيقة.
    */
    if (at.getTime() > from.getTime()) return at
  }

  /*
    والإزاحة بتتقاس على كل يوم لوحده لا بتتفترض ثابتة.

    التوقيت الصيفي بيغيّرها مرتين في السنة، والرقم المحفوظ كان
    بيخلّي البوست يتأخّر ساعة نص السنة.
  */
  for (let i = 1; i <= 14; i++) {
    const probe = new Date(from.getTime() + i * 86_400_000)
    const parts = localParts(probe, timezone)

    if (!days.includes(parts.weekday)) continue

    const at = zonedTime(parts.year, parts.month, parts.day, hh, mm, timezone)
    if (at.getTime() > from.getTime()) return at
  }

  return null
}

/** أجزاء التاريخ في منطقة زمنية */
function localParts(d: Date, timezone: string) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]))
  const wd = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(String(parts.weekday))

  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    weekday: wd < 0 ? 0 : wd,
  }
}

/**
 * لحظة UTC من وقت محلي في منطقة.
 *
 * بنبني تخمينًا ونقيس فرقه عن المطلوب ونصلّحه. `Intl` بيقول الوقت
 * المحلي للحظة، لكن مفيش عكسه في المنصة — والطرح الثابت بيغلط في
 * أيام تغيير التوقيت.
 */
function zonedTime(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: string,
): Date {
  const guess = Date.UTC(year, month - 1, day, hour, minute, 0)
  const asLocal = new Date(guess)
  const seen = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(asLocal)

  const p = Object.fromEntries(seen.map((x) => [x.type, Number(x.value)]))
  const seenUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour % 24, p.minute, 0)

  return new Date(guess - (seenUtc - guess))
}
