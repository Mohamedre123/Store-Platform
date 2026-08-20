/**
 * كتالوج الإضافات.
 *
 * كل إضافة هنا لازم يكون ليها أثر حقيقي في المتجر — نفس قاعدة التخصيص.
 * البكسلات دي اللي التاجر يقدر يشغّلها بنفسه دلوقتي: بيلصق المعرّف
 * وتشتغل فورًا من غير أي عقد أو موافقة.
 */

export type PluginField = {
  key: string
  label: string
  placeholder?: string
  hint?: string
}

export type PluginDef = {
  slug: string
  name: string
  desc: string
  /** المجموعة في الواجهة */
  group: 'pixels' | 'analytics' | 'ai'
  fields: PluginField[]
  /** إزاي التاجر يجيب المعرّف — بيوفّر عليه بحث */
  where?: string
  /**
   * إضافة ليها شاشة إعداد خاصة بدل حقول النص العادية.
   *
   * إضافات الذكاء الاصطناعي محتاجة تحقّق من المفتاح واختيار موديل
   * ووصف للمتجر — ده مش «الصق معرّفًا واقفل».
   */
  custom?: 'gemini' | 'gemini_pro' | 'claude'
  /** بيتحفظ في العمود المشفّر لا في config — مفتاح API مش معرّف عام */
  secretFields?: string[]
}

export const PLUGINS: PluginDef[] = [
  {
    slug: 'facebook_pixel',
    name: 'بكسل فيسبوك وإنستجرام',
    desc: 'بيقيس زيارات متجرك ومبيعاتك من إعلانات ميتا، وبيبني جمهور إعادة الاستهداف.',
    group: 'pixels',
    fields: [{ key: 'pixelId', label: 'معرّف البكسل', placeholder: '1234567890123456' }],
    where: 'من Meta Events Manager ← Data Sources ← البكسل بتاعك ← الرقم فوق الاسم.',
  },
  {
    slug: 'tiktok_pixel',
    name: 'بكسل تيك توك',
    desc: 'بيقيس نتايج إعلانات تيك توك ويحسّن استهدافها.',
    group: 'pixels',
    fields: [{ key: 'pixelId', label: 'معرّف البكسل', placeholder: 'C4XXXXXXXXXXXXXXXXXX' }],
    where: 'من TikTok Ads Manager ← Assets ← Events ← Web Events.',
  },
  {
    slug: 'snapchat_pixel',
    name: 'بكسل سناب شات',
    desc: 'بيقيس إعلانات سناب — مهم لجمهور الشباب في مصر والخليج.',
    group: 'pixels',
    fields: [{ key: 'pixelId', label: 'معرّف البكسل', placeholder: 'xxxxxxxx-xxxx-xxxx' }],
    where: 'من Snapchat Ads Manager ← Events Manager.',
  },
  {
    slug: 'google_analytics',
    name: 'جوجل أناليتكس (GA4)',
    desc: 'تقارير تفصيلية عن زوّار متجرك: منين جم، وإيه اللي بصّوا عليه.',
    group: 'analytics',
    fields: [{ key: 'measurementId', label: 'معرّف القياس', placeholder: 'G-XXXXXXXXXX' }],
    where: 'من Google Analytics ← Admin ← Data Streams ← الويب.',
  },
  {
    slug: 'google_ads',
    name: 'جوجل أدز',
    desc: 'بيتابع التحويلات من إعلانات جوجل والشوبينج.',
    group: 'pixels',
    fields: [
      { key: 'conversionId', label: 'معرّف التحويل', placeholder: 'AW-XXXXXXXXX' },
      { key: 'conversionLabel', label: 'ليبل التحويل (اختياري)', placeholder: 'abcDEF123' },
    ],
    where: 'من Google Ads ← Tools ← Conversions.',
  },

  {
    slug: 'gemini',
    name: 'Gemini — مساعد الكتابة',
    desc:
      'زرار «تحسين» جنب كل حقل نص في لوحتك: اسم المنتج، وصفه، عنوان صفحته في جوجل. ' +
      'وبوت للعملاء في متجرك بيرد على أسئلتهم عن منتجاتك وأسعارك.',
    group: 'ai',
    custom: 'gemini',
    secretFields: ['apiKey'],
    fields: [{ key: 'apiKey', label: 'مفتاح Gemini API', placeholder: 'مفتاحك من Google AI Studio' }],
    where:
      'من aistudio.google.com ← Get API key. المفتاح المجاني بيشتغل بحد يومي؛ لو متجرك عليه حركة، فعّل الفوترة عشان البوت ما يقفش.',
  },

  {
    slug: 'gemini_pro',
    name: 'Gemini Pro — مساعدك اللي بينفّذ',
    desc:
      'مش بيكتب بس — بيعمل. اسأله «أعمل خصم إزاي» يشرحلك ويعملهولك. ابعتله صور منتج ' +
      'وسعره يضيفه. غيّر حالة طلب، اعمل قسم، انشر المتجر — كل ده من الشات. ' +
      'وكل إجراء بيتعرض عليك بالعربي وما بيتنفّذش غير لما توافق.',
    group: 'ai',
    custom: 'gemini_pro',
    secretFields: ['apiKey'],
    fields: [
      { key: 'apiKey', label: 'مفتاح Gemini API (اختياري)', placeholder: 'سيبه فاضي عشان يستخدم مفتاح Gemini العادي' },
    ],
    where:
      'بيشتغل بمفتاح Gemini العادي لو مظبوط. حط مفتاحًا منفصل هنا لو عايز تفصل فاتورة المساعد عن باقي المنصة. المساعد بيستهلك أكتر من التحسين لأنه بيقرا بيانات متجرك — المفتاح المجاني هيقف بسرعة.',
  },

  {
    slug: 'claude',
    name: 'Claude — مصمّم الثيمات وصفحات الهبوط',
    desc:
      'مش عاجبك ولا ثيم من اللي عندنا؟ اوصف اللي في دماغك — الألوان والشكل والتخطيط — ' +
      'وكلود يعملهولك، وتقدر تعدّله بعدين من محرّر التخصيص زي أي ثيم. ' +
      'ونفس الحكاية في صفحات الهبوط.',
    group: 'ai',
    custom: 'claude',
    secretFields: ['apiKey'],
    fields: [{ key: 'apiKey', label: 'مفتاح Anthropic API', placeholder: 'مفتاحك من console.anthropic.com' }],
    where:
      'من console.anthropic.com ← API Keys. الحساب محتاج رصيد مشحون — مفيش خطة مجانية زي Gemini.',
  },
]

export function getPlugin(slug: string) {
  return PLUGINS.find((p) => p.slug === slug)
}

/** الإعدادات اللي المتجر بيحتاجها لحقن السكربتات */
export type ActivePixels = {
  facebookPixelId?: string
  tiktokPixelId?: string
  snapchatPixelId?: string
  gaMeasurementId?: string
  googleAdsId?: string
}
