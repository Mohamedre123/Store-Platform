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

export type ImageStyle =
  | 'auto'
  | 'literal'
  | 'scene'
  | 'plain'
  | 'model'
  | 'poster'
  | '3d'
  | 'flatlay'
  | 'macro'
  | 'outdoor'
  | 'occasion'
  | 'dark'
  | 'ugc'

/**
 * نوع الجودة اللي الشكل محتاجها.
 *
 * «تصوير فوتوغرافي حقيقي فائق الوضوح» على رندر 3D بتطلّع صورة، وعلى
 * بوستر بتشيل التصميم. كل شكل بياخد معايير الجودة اللي تناسبه.
 */
export type Craft = 'photo' | 'render' | 'design' | 'phone'

/**
 * أشكال الصورة.
 *
 * ## ليه قايمة مش توجيه واحد ثابت
 * التوجيه الثابت كان «مكان حقيقي، وممنوع خلفية سادة» لكل المنتجات.
 * فالتاجر اللي كتب «خلفية سادة» كان بيطلب حاجة ممنوعة في نفس الوصف —
 * والممنوع كان بيغلب. كل شكل ليه قواعده هو، ومفيش شكل بيمنع التاني.
 *
 * - `director` بيروح للمدير الفني: الفكرة لازم تبقى من النوع ده.
 * - `rules` بتروح لموديل الصور مع الفكرة: القيود اللي ما تتكسرش.
 * - `en` سطر إنجليزي لنفس القيد — موديلات الصور بتلتزم بالمصطلح
 *   التقني الإنجليزي («seamless backdrop»، «flat lay») أدق من ترجمته.
 *
 * ## و«زي ما أنا كاتب» مالوش مدير فني
 * التاجر اللي عارف هو عايز إيه بالظبط ما يصحّش موديل يضيف له فكرة من
 * عنده. الشكل ده بيبعت كلامه للرسم زي ما هو، ومعاه معايير الجودة بس.
 */
export const STYLES: Array<{
  key: ImageStyle
  label: string
  hint: string
  craft: Craft
  director: string
  rules: string[]
  en: string
}> = [
  {
    key: 'auto',
    label: 'يختار لوحده',
    hint: 'على حسب المنتج وكلامك',
    craft: 'photo',
    director: '',
    rules: [],
    en: '',
  },
  {
    key: 'literal',
    label: 'زي ما أنا كاتب',
    hint: 'بينفّذ وصفك بالحرف — من غير أفكار من عنده',
    craft: 'photo',
    director: '',
    rules: [],
    en: '',
  },
  {
    key: 'scene',
    label: 'مكان حقيقي',
    hint: 'المنتج في مكان استخدامه',
    craft: 'photo',
    director:
      'مشهد واقعي في مكان حقيقي بيتستخدم فيه المنتج — اذكر المكان بتفاصيله والعناصر اللي حوالين المنتج وليه موجودة.',
    rules: [
      'مكان حقيقي بتفاصيله — ممنوع خلفية لون واحد أو تدرّج.',
      'ممنوع منتج مقصوص طاير في الفراغ — المنتج حاطط على سطح أو مستخدَم في المكان.',
    ],
    en: 'Lifestyle advertising photograph of the product in a real, detailed location.',
  },
  {
    key: 'plain',
    label: 'خلفية سادة',
    hint: 'لون واحد نضيف — شكل الكتالوج الاحترافي',
    craft: 'photo',
    director:
      'خلفية سادة بلون واحد نضيف ممتد من غير أي مكان ولا ديكور ولا عناصر حوالين المنتج. ' +
      'اختار لون الخلفية اللي يبرز المنتج — ولو صاحب المتجر قال لون، يبقى هو.',
    rules: [
      'الخلفية لون واحد سادة ممتد (seamless) — ممنوع أي مكان أو أوضة أو ترابيزة أو ديكور أو نباتات أو عناصر جنب المنتج.',
      'ظل ناعم طبيعي تحت المنتج بس، عشان ما يبانش طاير.',
      'المنتج هو الحاجة الوحيدة في الصورة.',
    ],
    en: 'Studio product shot on a seamless solid single-color backdrop. No room, no furniture, no props, no scenery — only the product and a soft contact shadow.',
  },
  {
    key: 'model',
    label: 'موديل بيستخدمه',
    hint: 'شخص لابس المنتج أو ماسكه',
    craft: 'photo',
    director:
      'شخص حقيقي (موديل) لابس المنتج أو بيستخدمه في موقف طبيعي يناسب جمهور المنتج — المنتج واضح وهو محور الصورة، والشخص بيخدمه.',
    rules: [
      'شخص حقيقي بملامح وبشرة وأيدي طبيعية وتشريح صحيح.',
      'المنتج واضح بنفس شكله وتفاصيله — مش مستخبي ورا الشخص.',
    ],
    en: 'Advertising photograph with a real human model naturally wearing or using the product; the product is the clear focus.',
  },
  {
    key: 'poster',
    label: 'بوستر إعلاني',
    hint: 'تصميم بعنوان وعناصر جرافيك',
    craft: 'design',
    director:
      'بوستر إعلاني متصمَّم: المنتج بطل التصميم، مع عنوان قصير واضح وعناصر جرافيك وأشكال وألوان مدروسة — شكل حملات البراندات الكبيرة.',
    rules: [
      'تصميم نضيف بتسلسل بصري واضح: المنتج الأول وبعده العنوان.',
      'كلام قليل جدًا ومقروء — عنوان واحد وسطر صغير بالكتير.',
    ],
    en: 'Professional advertising poster / key visual design with the product as the hero.',
  },
  {
    key: '3d',
    label: 'ثري دي',
    hint: 'رندر ثلاثي الأبعاد — شكل البراندات الكبيرة',
    craft: 'render',
    director:
      'رندر ثلاثي الأبعاد احترافي: المنتج في مشهد 3D مصمَّم (أشكال هندسية، بوديوم، خامات لامعة، إضاءة استوديو ملوّنة) — مش صورة لمكان حقيقي.',
    rules: [
      'شكل رندر 3D نضيف وحديث — مش صورة فوتوغرافية لمكان حقيقي.',
      'المنتج نفسه يفضل بشكله وألوانه وتفاصيله الحقيقية جوّه المشهد.',
    ],
    en: '3D render (CGI) product visual: stylized geometric set, podiums, glossy materials, studio lighting. Not a real-world location photo.',
  },
  {
    key: 'flatlay',
    label: 'من فوق',
    hint: 'فلات لاي — المنتج وحاجات بتكمّله',
    craft: 'photo',
    director:
      'فلات لاي: لقطة من فوق عمودي تمامًا، المنتج على سطح (خشب، قماش، رخام) وحواليه حاجات بتكمّله مترتّبة بعناية.',
    rules: [
      'الكاميرا من فوق عمودي تمامًا (٩٠ درجة).',
      'العناصر حوالين المنتج مترتّبة ومش زحمة، والمنتج هو الأوضح.',
    ],
    en: 'Top-down flat lay photograph, camera directly overhead at 90 degrees, neatly arranged complementary items around the product.',
  },
  {
    key: 'macro',
    label: 'تفاصيل قريبة',
    hint: 'ماكرو للخامة والتفاصيل',
    craft: 'photo',
    director:
      'لقطة قريبة جدًا (ماكرو) بتبرز خامة المنتج وتفصيلة مميزة فيه — الخياطة، الملمس، اللمعة، النقوش.',
    rules: [
      'اللقطة قريبة على تفصيلة بعينها، والتفاصيل الدقيقة حادة جدًا.',
      'المنتج لازم يتعرف من التفصيلة.',
    ],
    en: 'Extreme close-up macro product photography revealing texture and craftsmanship details.',
  },
  {
    key: 'outdoor',
    label: 'مكان خارجي',
    hint: 'طبيعة أو شارع أو بحر',
    craft: 'photo',
    director:
      'مشهد خارجي حقيقي (طبيعة، شارع، بحر، صحرا، جنينة) يناسب المنتج وجمهوره، بإضاءة طبيعية جميلة.',
    rules: [
      'مكان خارجي حقيقي بتفاصيله — مش خلفية مرسومة.',
      'المنتج متدمج في المشهد بإضاءة وظلال متسقة معاه.',
    ],
    en: 'Outdoor advertising photograph in a real natural or urban location with beautiful natural light.',
  },
  {
    key: 'occasion',
    label: 'مناسبات وهدايا',
    hint: 'رمضان، عيد، هدية، احتفال',
    craft: 'photo',
    director:
      'مشهد مناسبة أو هدية (رمضان، عيد، عيد ميلاد، هدية متغلّفة، احتفال) بعناصر بتدل على المناسبة من غير زحمة — والمناسبة اللي صاحب المتجر قالها هي اللي تمشي.',
    rules: [
      'عناصر المناسبة واضحة بس المنتج هو الأهم.',
      'إحساس دافي واحتفالي ومرتّب.',
    ],
    en: 'Festive gifting / seasonal occasion advertising photograph with tasteful themed elements; the product remains the hero.',
  },
  {
    key: 'dark',
    label: 'فخم غامق',
    hint: 'خلفية غامقة وإضاءة درامية',
    craft: 'photo',
    director:
      'إعلان فخم: خلفية غامقة، وإضاءة درامية مركّزة على المنتج، ولمعة وانعكاسات هادية — شكل البراندات الفاخرة.',
    rules: [
      'خلفية غامقة وإضاءة درامية بتبرز المنتج.',
      'إحساس فخم وهادي، من غير زحمة عناصر.',
    ],
    en: 'Luxury dark moody product shot: deep dark background, dramatic lighting, subtle reflections, premium feel.',
  },
  {
    key: 'ugc',
    label: 'عفوية بالموبايل',
    hint: 'كأن عميل حقيقي صوّرها',
    craft: 'phone',
    director:
      'صورة عفوية كأن عميل حقيقي صوّرها بموبايله في حياته اليومية — طبيعية ومن غير إحساس استوديو، بس نضيفة ومضاءة كويس.',
    rules: [
      'شكل طبيعي وعفوي من غير إحساس استوديو.',
      'الصورة حادة ونضيفة والمنتج واضح.',
    ],
    en: 'Authentic user-generated style smartphone photo in everyday life.',
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

/** الأشكال اللي بتتفهم من الكلام — «لوحده» و«زي ما أنا كاتب» اختيار مش كلمة */
type WordStyle = Exclude<ImageStyle, 'auto' | 'literal'>

/*
  الترتيب مقصود: الأدق الأول.

  «خلفية سادة سودا» خلفية سادة لونها أسود — مش «فخم غامق». و«بوستر
  للعيد» بوستر، والمناسبة بتفضل في كلام التاجر اللي المدير الفني
  بيقراه. و«مينيمال» اتشال كشكل، فكلامه بيروح للخلفية السادة.

  **الأنماط بتتكتب بعد التوحيد**: «علي» لا «على»، و«ساده» لا «سادة».
  الكلام بيتوحّد قبل البحث، فالنمط المكتوب بالشكل الأصلي ما بيتلقطش
  أبدًا — و«على البحر» كانت بتعدّي من غير ما تتفهم.
*/
const STYLE_WORDS: Array<{ key: WordStyle; re: RegExp }> = [
  {
    key: 'plain',
    re: /ساد(ه|ا)|لون واحد|(بدون|من غير) خلفيه|خلفيه (بيضا|بيضاء|ابيض|سودا|سوداء|اسود|رمادي|ملونه|فاتحه)|ستوديو|استديو|studio|plain|solid (color|background)|white background|packshot|مينيمال|minimal/,
  },
  { key: 'poster', re: /بوستر|poster|key visual|تصميم (اعلان|اعلاني|جرافيك)|جرافيك/ },
  { key: '3d', re: /3d|3 ?دي|ثري ?دي|ثلاثي(ه)? الابعاد|رندر|render|cgi/ },
  { key: 'flatlay', re: /فلات ?لاي|flat ?lay|من فوق|من اعلي|top ?(view|down)/ },
  { key: 'macro', re: /ماكرو|macro|كلوز|close ?up|تفاصيل قريبه|قريب جدا/ },
  {
    key: 'model',
    re: /موديل (لابس|لابسه|ماسك|ماسكه|بيستخدم)|(بنت|ولد|راجل|ست|شخص|شاب) (لابس|لابسه|ماسك|ماسكه)|لابسه موديل|on model|human model/,
  },
  { key: 'ugc', re: /عفوي|عفويه|بالموبايل|بالفون|ugc|كان عميل صور/ },
  {
    key: 'occasion',
    re: /رمضان|عيد (ميلاد|الام|الحب|الفطر|الاضحي)|العيد|مناسبه|هديه متغلفه|تغليف هدايا|كريسماس|valentine/,
  },
  {
    key: 'outdoor',
    re: /(في|علي|عند) (البحر|الشط|الطبيعه|الجبل|الصحرا|الصحراء|الجنينه|الحديقه|الشارع)|خارجي|outdoor/,
  },
  { key: 'dark', re: /فخم|فخامه|luxury|دارك|dark|خلفيه (غامقه|داكنه)/ },
  {
    key: 'scene',
    re: /مكان (حقيقي|واقعي)|مشهد (حقيقي|واقعي)|صوره واقعيه|lifestyle|لايف ?ستايل|في (البيت|المطبخ|الاوضه|المكتب|الجيم|الصالون)/,
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
export function inferStyle(text: string | null | undefined): WordStyle | null {
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
 * الشكل النهائي.
 *
 * «زي ما أنا كاتب» بيغلب أي حاجة: التاجر اختار إن كلامه يتنفّذ بالحرف،
 * فكلمة «سادة» جوّه كلامه جزء من الوصف مش أمر بتغيير الشكل. وغير كده:
 * الكلام المكتوب، وبعده الاختيار.
 *
 * بيتنادى على الخادم وقت التوليد وعلى الشاشة وقت الكتابة — بنفس
 * القواعد، فاللي التاجر شايفه متعلّم هو اللي بيتولّد.
 */
export function resolveStyle(
  chosen: string | null | undefined,
  text: string | null | undefined,
): ImageStyle {
  const picked = styleOf(chosen).key
  if (picked === 'literal') return 'literal'
  return inferStyle(text) ?? picked
}

/**
 * نوع الجودة للشكل.
 *
 * «زي ما أنا كاتب» بياخد نوع الجودة من كلام التاجر نفسه: لو كتب «رندر
 * 3D» بياخد جودة رندر، ولو كتب «بوستر» بياخد جودة تصميم.
 */
export function craftOf(style: ImageStyle, text?: string | null): Craft {
  if (style !== 'literal' && style !== 'auto') return styleOf(style).craft
  const typed = inferStyle(text)
  return typed ? styleOf(typed).craft : 'photo'
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
