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
   شكل الصورة
   ══════════════════════════════════════════════════════════════ */

export type ImageStyle = 'auto' | 'scene' | 'plain' | 'minimal' | '3d' | 'flatlay' | 'dark'

/**
 * أشكال الصورة.
 *
 * ## ليه قايمة مش توجيه واحد ثابت
 * التوجيه الثابت كان «مكان حقيقي، وممنوع خلفية سادة» لكل المنتجات.
 * فالتاجر اللي كتب «خلفية سادة» كان بيطلب حاجة ممنوعة في نفس
 * الوصف — والممنوع كان بيغلب، وطلعت صورة في مكان جوّه إطار أبيض.
 * كل شكل ليه قواعده هو، ومفيش شكل بيمنع التاني.
 *
 * - `director` بيروح للمدير الفني: الفكرة لازم تبقى من النوع ده.
 * - `rules` بتروح لموديل الصور مع الفكرة: القيود اللي ما تتكسرش.
 * - `en` سطر إنجليزي لنفس القيد — موديلات الصور بتلتزم بالمصطلح
 *   التقني الإنجليزي («seamless backdrop»، «flat lay») أدق من
 *   ترجمته.
 */
export const STYLES: Array<{
  key: ImageStyle
  label: string
  hint: string
  director: string
  rules: string[]
  en: string
}> = [
  {
    key: 'auto',
    label: 'يختار لوحده',
    hint: 'على حسب المنتج وكلامك',
    director: '',
    rules: [],
    en: '',
  },
  {
    key: 'scene',
    label: 'مكان حقيقي',
    hint: 'المنتج في مكان استخدامه',
    director:
      'مشهد واقعي في مكان حقيقي بيتستخدم فيه المنتج — اذكر المكان بتفاصيله والعناصر اللي حوالين المنتج وليه موجودة.',
    rules: [
      'مكان حقيقي بتفاصيله — ممنوع خلفية لون واحد أو تدرّج.',
      'ممنوع منتج مقصوص طاير في الفراغ — المنتج حاطط على سطح أو مستخدَم في المكان.',
    ],
    en: 'Photorealistic lifestyle advertising photograph of the product in a real, detailed location.',
  },
  {
    key: 'plain',
    label: 'خلفية سادة',
    hint: 'لون واحد نضيف — شكل الكتالوج الاحترافي',
    director:
      'خلفية سادة بلون واحد نضيف ممتد من غير أي مكان ولا ديكور ولا عناصر حوالين المنتج. ' +
      'اختار لون الخلفية اللي يبرز المنتج — ولو صاحب المتجر قال لون، يبقى هو.',
    rules: [
      'الخلفية لون واحد سادة ممتد (seamless) — ممنوع أي مكان أو أوضة أو ترابيزة أو ديكور أو نباتات أو عناصر جنب المنتج.',
      'ظل ناعم طبيعي تحت المنتج بس، عشان ما يبانش طاير.',
      'إضاءة استوديو ناعمة ومتوازنة، والمنتج هو الحاجة الوحيدة في الصورة.',
    ],
    en: 'Clean studio product shot on a seamless solid single-color backdrop. No room, no furniture, no props, no scenery — only the product and a soft contact shadow.',
  },
  {
    key: 'minimal',
    label: 'مينيمال',
    hint: 'فاتح وهادي، وعنصر أو اتنين بس',
    director:
      'تكوين مينيمال: خلفية هادية بألوان فاتحة، وعنصر أو اتنين بسطاء بس (بوديوم، ظل شباك، شكل هندسي)، ومساحة فاضية واسعة.',
    rules: [
      'عنصر أو اتنين بالكتير جنب المنتج، ومساحة فاضية واسعة.',
      'ألوان هادية ومتناسقة — من غير زحمة ولا تفاصيل كتير.',
    ],
    en: 'Minimalist product photography, soft neutral palette, generous negative space, at most one or two simple props such as a podium or a soft window shadow.',
  },
  {
    key: '3d',
    label: 'ثري دي',
    hint: 'رندر ثلاثي الأبعاد — شكل البراندات الكبيرة',
    director:
      'رندر ثلاثي الأبعاد احترافي: المنتج في مشهد 3D مصمَّم (أشكال هندسية، بوديوم، خامات لامعة، إضاءة استوديو ملوّنة) — مش صورة لمكان حقيقي.',
    rules: [
      'شكل رندر 3D نضيف وحديث — مش صورة فوتوغرافية لمكان حقيقي.',
      'المنتج نفسه يفضل بشكله وألوانه وتفاصيله الحقيقية جوّه المشهد.',
    ],
    en: 'High-end 3D render (CGI) product visual: stylized geometric set, podiums, glossy materials, studio lighting. Not a real-world location photo.',
  },
  {
    key: 'flatlay',
    label: 'من فوق',
    hint: 'فلات لاي — المنتج وحاجات بتكمّله',
    director:
      'فلات لاي: لقطة من فوق عمودي تمامًا، المنتج على سطح (خشب، قماش، رخام) وحواليه حاجات بتكمّله مترتّبة بعناية.',
    rules: [
      'الكاميرا من فوق عمودي تمامًا (٩٠ درجة).',
      'العناصر حوالين المنتج مترتّبة ومش زحمة، والمنتج هو الأوضح.',
    ],
    en: 'Top-down flat lay photograph, camera directly overhead at 90 degrees, neatly arranged complementary items around the product.',
  },
  {
    key: 'dark',
    label: 'فخم غامق',
    hint: 'خلفية غامقة وإضاءة درامية',
    director:
      'إعلان فخم: خلفية غامقة، وإضاءة درامية مركّزة على المنتج، ولمعة وانعكاسات هادية — شكل البراندات الفاخرة.',
    rules: [
      'خلفية غامقة وإضاءة درامية بتبرز المنتج.',
      'إحساس فخم وهادي، من غير زحمة عناصر.',
    ],
    en: 'Luxury dark moody product shot: deep dark background, dramatic rim lighting, subtle reflections, premium feel.',
  },
]

export function styleOf(key: string | null | undefined) {
  return STYLES.find((s) => s.key === key) ?? STYLES[0]
}

/** توحيد الكتابة قبل البحث — «سادة» و«ساده» و«سادا» واحد */
function normalizeArabic(text: string): string {
  return text
    .toLowerCase()
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
}

/*
  الترتيب مقصود: الأدق الأول.

  «خلفية سادة سودا» خلفية سادة لونها أسود — مش «فخم غامق». و«من فوق
  على خلفية سادة» خلفية سادة، والزاوية بتفضل في كلام التاجر اللي
  المدير الفني بيقراه.
*/
const STYLE_WORDS: Array<{ key: Exclude<ImageStyle, 'auto'>; re: RegExp }> = [
  {
    key: 'plain',
    re: /ساد(ه|ا)|لون واحد|(بدون|من غير) خلفيه|خلفيه (بيضا|بيضاء|ابيض|سودا|سوداء|اسود|رمادي|ملونه)|ستوديو|استديو|studio|plain|solid (color|background)|white background|packshot/,
  },
  { key: '3d', re: /3d|3 ?دي|ثري ?دي|ثلاثي(ه)? الابعاد|رندر|render|cgi/ },
  { key: 'flatlay', re: /فلات ?لاي|flat ?lay|من فوق|من اعلي|top ?(view|down)/ },
  { key: 'minimal', re: /مينيمال|minimal|خلفيه فاتحه/ },
  { key: 'dark', re: /فخم|فخامه|luxury|دارك|dark|خلفيه (غامقه|داكنه)/ },
  {
    key: 'scene',
    re: /مكان (حقيقي|واقعي)|مشهد (حقيقي|واقعي)|صوره واقعيه|lifestyle|لايف ?ستايل|في (البيت|المطبخ|الشارع|الطبيعه|الاوضه|المكتب|الجيم)/,
  },
]

/**
 * الشكل المفهوم من كلام التاجر.
 *
 * ## ليه الكلام بيغلب الاختيار
 * التاجر بيكتب «خلفية سادة» وهو ناسي إن الاختيار فوق على «يختار
 * لوحده» — أو في جدول اتعمل قبل ما الاختيار يبقى موجود أصلًا.
 * الجملة المكتوبة هي الأمر الصريح، والاختيار افتراضي.
 *
 * ## والنفي بيتشاف
 * «مش عايز خلفية سادة» عكس «خلفية سادة». بنبص على الكلمتين اللي
 * قبل الكلمة، ولو فيهم نفي بنعدّيها.
 */
export function inferStyle(text: string | null | undefined): Exclude<ImageStyle, 'auto'> | null {
  if (!text?.trim()) return null
  const t = normalizeArabic(text)

  for (const { key, re } of STYLE_WORDS) {
    const global = new RegExp(re.source, 'g')
    for (const m of t.matchAll(global)) {
      /*
        كلمة واحدة مسموح بيها بين النفي والشكل: «مش عايز **خلفية**
        سادة». من غيرها النفي ما كانش بيتشاف في أشهر صيغة بيتكتب بيها.
      */
      const before = t.slice(Math.max(0, m.index - 28), m.index)
      if (
        /(^|\s)(مش|مو|بلاش|ممنوع|not|no|without)\s+((عايز|عاوز|حابب|محتاج)\s+)?(\S+\s+)?$/.test(
          before,
        )
      ) {
        continue
      }
      return key
    }
  }

  return null
}

/**
 * الشكل النهائي — الكلام المكتوب، وبعده الاختيار.
 *
 * بيتنادى على الخادم وقت التوليد وعلى الشاشة وقت الكتابة — بنفس
 * القواعد، فاللي التاجر شايفه متعلّم هو اللي بيتولّد.
 */
export function resolveStyle(
  chosen: string | null | undefined,
  text: string | null | undefined,
): ImageStyle {
  return inferStyle(text) ?? styleOf(chosen).key
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
